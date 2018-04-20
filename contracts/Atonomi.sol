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
* @notice governs the activation and regsitration of devices, as well as whitelisting of IRN nodes and manufacturers.
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
    * @dev key: address, value: WhitelistMember Struct
    */
    mapping (address => WhitelistMember) whitelist;


    /*
    * BALANCE MAPPING 
    * TODO NATSPEC
    */
    mapping (address => uint256) balances;

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

    struct WhitelistMember {
        bool isIRNAdmin;
        bool isManufacturer;
        bool isIRNNode;
        bytes32 memberId;
    }

    /*
     * MODIFIERS 
     */
    /*
     * @dev Throw if called by any account that's not whitelisted under the respective flag.
     */
    modifier onlyManufacturer() {
        require(whitelist[msg.sender].isManufacturer);
        _;
    }

    modifier onlyIRN() {
        require(whitelist[msg.sender].isIRNAdmin);
        _;
    }

    modifier onlyReputationManager() {
        require(whitelist[msg.sender].isIRNNode);
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
    event WhitelistMemberAdded(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /*
    * TODO natspec
    */
    event WhitelistMemberRemoved(address indexed _sender, address indexed _member, bytes32 indexed _memberId);
    
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
        
        require(whitelist[msg.sender].memberId == _manufacturerId);

        Device memory device = Device(_hardwarePublicKey, _manufacturerId, true, false, "");

        bytes32 deviceHashKey = keccak256(_deviceIdHash);

        registeredDevices[deviceHashKey] = device;

        require(token.transferFrom(msg.sender, address(this), registrationFee));

        balances(msg.sender) += registrationFee;

        emit RegistrationComplete(msg.sender, deviceHashKey);
    }

    /*
    * TODO natspec
    */
    function payActivationFee(bytes32 _deviceId) public {

        require(registeredDevices[keccak256(_deviceId)].registered);
        
        bytes32 deviceHashKey = keccak256(_deviceId, msg.sender);

        activationPool[deviceHashKey] = registeredDevices[deviceHashKey];

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

        activatedDevices[_deviceId].reputation = _reputationScore;

        require(token.transferFrom(msg.sender, address(this), reputationReward));
        
        emit ReputationUpdated(msg.sender, _deviceId, _reputationScore);
    }


    /*
    * WHITELIST ADD/REMOVE LOGIC
    */

    /**
     * @dev add a member to the whitelist
     * @param _address address
     * @param _isIRNAdmin bool
     * @param _isManufacturer bool
     * @param _memberId bytes32
     * @return true if the address was added to the whitelist, false if the address was already in the whitelist
    */ 
    function addWhitelistMember(address _address, bool _isIRNAdmin, bool _isManufacturer, bool _isIRNNode, bytes32 _memberId) onlyIRN public returns(bool success) {   
      
      require(!whitelist[_address].isIRNAdmin);
      require(!whitelist[_address].isManufacturer);
      require(!whitelist[_address].isIRNNode);
      
      WhitelistMember memory whitelistMember = WhitelistMember(_isIRNAdmin, _isManufacturer, _isIRNNode, _memberId);

      whitelist[_address] = whitelistMember;

      emit WhitelistMemberAdded(msg.sender, _address, _memberId);

      success = true;
    }   

    /**
     * @dev remove a member from the whitelist
     * @param _address address
     * @return true if the address was removed from the whitelist,
     * false if the address wasn't in the whitelist in the first place
     */ 
    function removeWhitelistMember(address _address) onlyIRN public returns(bool success) {

      bytes32 memberId = whitelist[_address].memberId;

      delete whitelist[_address];

      emit WhitelistMemberRemoved(msg.sender, _address, memberId);

      success = true;
    }

    /* 
    * TODO natspec
    */
    function withdraw(uint256 _amount) onlyOwner public{

        require(token.transferFrom(msg.sender, address(this), _amount));
        
        emit Withdrawal(msg.sender, _amount);
    }
}