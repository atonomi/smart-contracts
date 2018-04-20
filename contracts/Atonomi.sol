pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/Ownership/Ownable.sol";

// ----------------------------------------------------------------------------
// ERC Token Standard #20 Interface
// https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md
// ----------------------------------------------------------------------------
contract ERC20Interface {
    function totalSupply() public constant returns (uint);
    function balanceOf(address tokenOwner) public constant returns (uint balance);
    function allowance(address tokenOwner, address spender) public constant returns (uint remaining);
    function transfer(address to, uint tokens) public returns (bool success);
    function approve(address spender, uint tokens) public returns (bool success);
    function transferFrom(address from, address to, uint tokens) public returns (bool success);

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}


/* 
* @title Atonomi Contract
* @notice governs the activation and regsitration of devices, as well as networking of IRN nodes and manufacturers.
* @dev exposes state and functions of devices
* @dev ownable by the Parity/IRN node that write it
*/
contract Atonomi is Ownable{

    /*
     * STATE VARIABLES
     */
    uint256 public activationFee;
    uint256 public registrationFee;
    uint256 public reputationReward;

    ERC20 public token;
    

    /*
     * STORAGE MAPPINGS 
     */

    /* 
     * @dev key: deviceId hash, value: Device Struct
     */
    mapping (bytes32 => Device) registeredDevices;

    /* 
    * @dev key: deviceId (hahsed with msg.sender), value: Device Struct
    */
    mapping (bytes32 => Device) activationPool;

    /* 
    * @dev key: deviceId (in the clear), value: Device Struct
    */
    mapping (bytes32 => Device) activatedDevices;
    
    /*
    * @dev key: address, value: NetworkMember Struct
    */
    mapping (address => NetworkMember) network;

    /*
    * @dev key: Manufacturer Id, value: address of the IRN
    */
    mapping (bytes32 => address) iRNLookup;

    /*
     * TYPES 
     */
    struct Device {
        bytes32 hardwarePublicKey;
        bytes32 manufacturerId;
        bool registered;
        bool activated;
        bytes reputation;
    }

    struct NetworkMember {
        bool isIRNAdmin;
        bool isManufacturer;
        bool isIRNNode;
        bytes32 memberId;
        int256 balance;
    }

    /*
     * MODIFIERS 
     */
    /*
     * @dev Throw if called by any account that's not networked under the respective flag.
     */
    modifier onlyManufacturer() {
        require(msg.sender == owner || whitelist[msg.sender].isManufacturer);
        _;
    }

    modifier onlyIRN() {
        require(msg.sender == owner || whitelist[msg.sender].isIRNAdmin);
        _;
    }

    modifier onlyReputationManager() {
        require(msg.sender == owner || whitelist[msg.sender].isIRNNode);
        _;
    }

    /*
     * CONSTRUCTOR
     * @dev initializes a device management contract to manage ATMI transactions across devices
     * @param atonomi token address
     * @param registration fee
     * @param activation fee
     */
    function Atonomi (address _token, uint256 _registrationFee, uint256 _activationFee, uint256 _reputationReward)
        public 
    {
        require(_token != address(0));
        require(_activationFee > 0);
        require(_registrationFee > 0);
        require(_reputationReward > 0);

        token = ERC20(_token);
        activationFee = _activationFee;
        registrationFee = _registrationFee;
        reputationReward = _reputationReward;
    }


    /*
    * EVENTS 
    */

    /* 
    * @dev on activation hash
    * @param deviceId
    */
    event ActivationPaid(address indexed _sender, bytes32 indexed deviceHashKey);

    /* 
    * @dev on activation commit
    * @param deviceId
    */
    event ActivationComplete(address indexed _sender, bytes32 indexed deviceId);

    /*
    * @dev on successful registration
    * @param deviceId
    */
    event RegistrationComplete(address indexed _sender, bytes32 indexed deviceHashKey);

    /*
    * TODO natspec
    */
    event NetworkMemberAdded(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /*
    * TODO natspec
    */
    event NetworkMemberRemoved(address indexed _sender, address indexed _member, bytes32 indexed _memberId);
    
    /*
    * TODO natspec
    */
    event Withdrawal(address _sender, uint256 _amount);
    
     /*
    * TODO natspec
    */
    event ReputationUpdated( address indexed _sender, bytes32 indexed _deviceId, bytes _newScore);
    
    
    /*
    * DEVICE LOGIC
    */

    /*
    * TODO natspec
    */
    function registerDevice (bytes32 _deviceIdHash, bytes32 _hardwarePublicKey, bytes32 _manufacturerId) onlyManufacturer public {

        require(_deviceIdHash != 0);
        require(_hardwarePublicKey != 0);
        
        require(network[msg.sender].memberId == _manufacturerId);

        Device memory device = Device(_hardwarePublicKey, _manufacturerId, true, false, "");

        bytes32 deviceHashKey = keccak256(_deviceIdHash);

        registeredDevices[deviceHashKey] = device;

        network[iRNLookup[msg.sender]].balance  += registrationFee;

        require(token.transferFrom(msg.sender, address(this), registrationFee));

        emit RegistrationComplete(msg.sender, deviceHashKey);
    }

    /*
    * TODO natspec
    */
    function payActivationFee(bytes32 _deviceId) public {

        require(registeredDevices[keccak256(_deviceId)].registered);
        
        bytes32 deviceHashKey = keccak256(_deviceId, msg.sender);

        activationPool[deviceHashKey] = registeredDevices[deviceHashKey];

        network[iRNLookup[msg.sender]].balance  += activationFee;
        
        require(token.transferFrom(msg.sender, address(this), activationFee));

        emit ActivationPaid(msg.sender, deviceHashKey);
    }

    /*
    * TODO natspec
    */
    function completeActivation(bytes32 _deviceId) public {

        bytes32 deviceHashKey = keccak256(_deviceId, msg.sender);
        
        require(activationPool[deviceHashKey].registered == true);

        activatedDevices[_deviceId] = activationPool[deviceHashKey];

        activatedDevices[_deviceId].activated = true;

        emit ActivationComplete(msg.sender, _deviceId);
    }


    /* 
    * TODO NATSPEC
    * @dev registers and immediately activates device, bypasses hash/commit logic since we can mark device activated right away.
    */
    function registerAndActivateDevice (bytes32 _deviceId, bytes32 _hardwarePublicKey, bytes32 _manufacturerId) onlyManufacturer public {

        require(_deviceId[0] != 0);
        require(_hardwarePublicKey[0] != 0);
        require(_manufacturerId[0] != 0);

        Device memory device = Device(_hardwarePublicKey, _manufacturerId, true, true, "");

        bytes32 deviceHashKey = keccak256(_deviceId);

        registeredDevices[deviceHashKey] = device;
        
        emit RegistrationComplete(msg.sender, deviceHashKey);

        activatedDevices[_deviceId] = device;

        network[iRNLookup[msg.sender]].balance += (registrationFee + activationFee);

        require(token.transferFrom(msg.sender, address(this), registrationFee + activationFee));

        emit ActivationComplete(msg.sender, _deviceId);
    }


    /*
    *REPUTATION MANAGEMENT
    */
    
    /*
    * TODO natspec
    */
    function setReputation(bytes32 _deviceId, bytes _reputationScore) onlyReputationManager public {

        require(_reputationScore[0] != 0);
        require(activatedDevices[_deviceId].activated);

        require(token.transferFrom(msg.sender, address(this), reputationReward));
        
        emit ReputationUpdated(msg.sender, _deviceId, _reputationScore);
    }


    /*
    * WHITELIST ADD/REMOVE LOGIC
    */

    /**
     * @dev add a member to the network
     * @param _address address
     * @param _isIRNAdmin bool
     * @param _isManufacturer bool
     * @param _memberId bytes32
     * @return true if the address was added to the network, false if the address was already in the network
    */ 
    function addNetworkMember(address _address, bool _isIRNAdmin, bool _isManufacturer, bool _isIRNNode, bytes32 _memberId) onlyIRN public returns(bool success) {   
      
      require(!network[_address].isIRNAdmin);
      require(!network[_address].isManufacturer);
      require(!network[_address].isIRNNode);
      
      NetworkMember memory networkMember = NetworkMember(_isIRNAdmin, _isManufacturer, _isIRNNode, _memberId, 0);

      network[_address] = networkMember;

      emit NetworkMemberAdded(msg.sender, _address, _memberId);

        success = true;
    }

    /**
     * @dev remove a member from the network
     * @param _address address
     * @return true if the address was removed from the network,
     * false if the address wasn't in the network in the first place
     */ 
    function removeNetworkMember(address _address) onlyIRN public returns(bool success) {

      bytes32 memberId = network[_address].memberId;

      delete network[_address];

      emit NetworkMemberRemoved(msg.sender, _address, memberId);

      success = true;
    }

    /*
    * TODO natspec
    */
    function withdraw(uint256 _amount) onlyOwner public{
        
        require(network[msg.sender].isIRNNode);
        require(network[iRNLookup[msg.sender]].balance >= _amount);

        require(token.transferFrom(msg.sender, address(this), _amount));
        
        emit Withdrawal(msg.sender, _amount);
    }
}