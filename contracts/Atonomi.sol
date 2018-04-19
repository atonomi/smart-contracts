pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/Ownership/Ownable.sol";

/**
 * @title ERC827 interface, an extension of ERC20 token standard
 *
 * @dev Interface of a ERC827 token, following the ERC20 standard with extra
 * @dev methods to transfer value and data and execute calls in transfers and
 * @dev approvals.
 */
contract ERC827 is ERC20 {
  function approve(address _spender, uint256 _value, bytes _data) public returns (bool);
  function transfer(address _to, uint256 _value, bytes _data) public returns (bool);
  function transferFrom(address _from, address _to, uint256 _value, bytes _data) public returns (bool);
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

    ERC827 public token;
    

    /*
    * STORAGE MAPPINGS 
    */

    /* 
    * @dev key: deviceId hash, value: Device Struct
    */
    mapping (bytes32 => Device) registeredDevices;

    /* 
    * @dev key: deviceId (in the clear), value: Device Struct
    */
    mapping (bytes32 => Device) activatedDevices;
    
    /*
    * @dev key: address, value: WhitelistMember Struct
    */
    mapping (address => WhitelistMember) whitelist;


    /*
    * TYPES 
    */

    struct Device {
        bytes32 hardwarePublicKey;
        bytes32 manufacturerId;
        bool registered;
        bool readyToActivate;
        bool activated;
        bytes reputation;
    }

    struct WhitelistMember {
        bool isIRN;
        bool isManufacturer;
        bool isReputationManager;
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
        require(whitelist[msg.sender].isIRN);
        _;
    }

    modifier onlyReputationManager() {
        require(whitelist[msg.sender].isReputationManager);
        _;
    }

    /*
    * CONSTRUCTOR
    *
    * @dev initializes a device management contract to manage ATMI transactions across devices
    * @param atonomi token address
    * @param registration fee
    * @param activation fee
    */
    function Atonomi (address _token, uint256 _activationFee, uint256 _registrationFee, uint256 _reputationReward) public {

        require(_token != address(0));
        require(_activationFee > 0);
        require(_registrationFee > 0);
        require(_reputationReward > 0);

        token = ERC827(_token);
        activationFee = _activationFee;
        registrationFee = _registrationFee;
        reputationReward = _reputationReward;

        whitelist[msg.sender] = WhitelistMember(true, false, true, "");
    }


    /*
    * EVENTS 
    */

    /* 
    * @dev on activation hash
    * @param deviceId
    */
    event ActivationPaid(bytes32 deviceHashKey, address _sender);

    /* 
    * @dev on activation commit
    * @param deviceId
    */
    event ActivationComplete(bytes32 deviceId, address _sender);

    /*
    * @dev on successful registration
    * @param deviceId
    */
    event RegistrationComplete(bytes32 deviceHashKey, address _sender);

    /*
    * TODO natspec
    */
    event WhitelistMemberAdded(address _address, bytes32 _memberId, address _sender);

    /*
    * TODO natspec
    */
    event WhitelistMemberRemoved(address _address, bytes32 _memberId, address _sender);
    
    /*
    * TODO natspec
    */
    event Withdrawal(address _address, uint256 _amount);
    
     /*
    * TODO natspec
    */
    event ReputationUpdated(bytes32 _deviceId, bytes _newScore, address _spender);
    
    
    /*
    * DEVICE LOGIC
    */

    /*
    * TODO natspec
    */
    function registerDevice (bytes32 _deviceIdHash, bytes32 _hardwarePublicKey, bytes32 _manufacturerId) onlyManufacturer public {

        require(whitelist[msg.sender].memberId == _manufacturerId);

        Device memory device = Device(_hardwarePublicKey, _manufacturerId, true, false, false, "");

        bytes32 deviceHashKey = keccak256(_deviceIdHash);

        registeredDevices[deviceHashKey] = device;

        emit RegistrationComplete(deviceHashKey, msg.sender);

        token.transferFrom(msg.sender, address(this), registrationFee);
    }

    /*
    * TODO natspec
    */
    function payActivationFee(bytes32 _deviceId) public {

        require(registeredDevices[keccak256(_deviceId)].registered);
        
        bytes32 deviceHashKey = keccak256(_deviceId, msg.sender);

        registeredDevices[keccak256(_deviceId)].readyToActivate = true;

        token.transferFrom(msg.sender, address(this), activationFee);

        emit ActivationPaid(deviceHashKey, msg.sender);
    }

    /*
    * TODO natspec
    */
    function completeActivation(bytes32 _deviceId) public {

        bytes32 deviceHashKey = keccak256(_deviceId, msg.sender);
        
        require(registeredDevices[keccak256(_deviceId)].readyToActivate == true);
        
        require(activatedDevices[deviceHashKey].activated);

        activatedDevices[_deviceId] = registeredDevices[deviceHashKey];

        activatedDevices[_deviceId].activated = true;

        emit ActivationComplete(_deviceId, msg.sender);
    }


    /* 
    * TODO NATSPEC
    * @dev registers and immediately activates device, bypasses hash/commit logic since we can mark device activated right away.
    */
    function registerAndActivateDevice (bytes32 _deviceId, bytes32 _hardwarePublicKey, bytes32 _manufacturerId) onlyManufacturer public {

        require(_deviceId[0] != 0);
        require(_hardwarePublicKey[0] != 0);
        require(_manufacturerId[0] != 0);

        Device memory device = Device(_hardwarePublicKey, _manufacturerId, true, true, true, "");

        bytes32 deviceHashKey = keccak256(_deviceId);

        registeredDevices[deviceHashKey] = device;
        emit RegistrationComplete(deviceHashKey, msg.sender);

        activatedDevices[_deviceId] = device;
        emit ActivationComplete(_deviceId, msg.sender);

        token.transferFrom(msg.sender, address(this), registrationFee + activationFee);
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

        token.transferFrom(msg.sender, address(this), reputationReward);
        
        emit ReputationUpdated(_deviceId, _reputationScore, msg.sender);
    }


    /*
    * WHITELIST ADD/REMOVE LOGIC
    */

    /**
     * @dev add a member to the whitelist
     * @param _address address
     * @param _isIRN bool
     * @param _isManufacturer bool
     * @param _memberId bytes32
     * @return true if the address was added to the whitelist, false if the address was already in the whitelist
    */ 
    function addWhitelistMember(address _address, bool _isIRN, bool _isManufacturer, bool _isReputationManager, bytes32 _memberId) onlyIRN public returns(bool success) {   
      
      require(!whitelist[_address].isIRN && !whitelist[_address].isManufacturer && !whitelist[_address].isReputationManager);
      
      WhitelistMember memory whitelistMember = WhitelistMember(_isIRN, _isManufacturer, _isReputationManager, _memberId);

      whitelist[_address] = whitelistMember;

      emit WhitelistMemberAdded(_address, _memberId, msg.sender);

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

      emit WhitelistMemberRemoved(_address, memberId, msg.sender);

      success = true;
    }

    /* 
    * TODO natspec
    */
    function withdraw(uint256 _amount) onlyOwner public{

        emit Withdrawal(msg.sender, _amount);

        token.transferFrom(address(this), msg.sender, _amount);
    }
}