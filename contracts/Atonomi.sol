pragma solidity ^0.4.21;

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
* @notice governs the activation and regsitration of devices, and restricts roles of network participants.
* @dev exposes state and functions of devices
* @dev ownable by the Parity/IRN node that write it
*/
contract Atonomi is Ownable {

    /*
    * STATE VARIABLES
    */

    //Paid by manufacturer to register a device
    uint256 public registrationFee;

    //Paid by manufacturer or device owner to activate device
    uint256 public activationFee;

    //Paid to nodes that compute and update a device's reputation
    uint256 public reputationReward;

    ERC20Interface public token;

    /*
    * STORAGE MAPPINGS 
    */
    /* 
    * @dev must contain all devices that are registered but NOT activated. key: deviceId hash, value: Device Struct
    */
    mapping (bytes32 => Device) public devices;

    /*
    * @dev must contain all IRNs and manufacturers that can write to devices. key: address, value: NetworkMember Struct
    */
    mapping (address => NetworkMember) public network;

    /*
    * @dev must contain the manufacturer ID's corresponding to each IRN. key: Manufacturer Id, value: address of the IRN
    */
    mapping (bytes32 => address) public iRNLookup;

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
        uint256 balance;
    }

    /*
     * MODIFIERS 
     * @dev Throw if called by any account that's not networked under the respective flag.
     */
    modifier onlyManufacturer() {
        require(network[msg.sender].isManufacturer);
        _;
    }

    modifier onlyIRNorOwner() {
        require(msg.sender == owner || network[msg.sender].isIRNAdmin);
        _;
    }

    modifier onlyIRNNode() {
        require(network[msg.sender].isIRNNode);
        _;
    }

    /*
     * CONSTRUCTOR
     * @dev sets initial state variable values
     * @param _token atonomi token address
     * @param _registrationFee initial registration fee on the network
     * @param _activationFee initial activation fee on the network
     * @param _reputationReward initial reputation reward on the network
     */
    function Atonomi (address _token, uint256 _registrationFee, uint256 _activationFee, uint256 _reputationReward)
        public 
    {
        require(_token != address(0));
        require(_activationFee > 0);
        require(_registrationFee > 0);
        require(_reputationReward > 0);

        token = ERC20Interface(_token);
        activationFee = _activationFee;
        registrationFee = _registrationFee;
        reputationReward = _reputationReward;
    }

    /*
    * EVENTS 
    */
    /*
    * @dev on successful registration
    * @param _sender manufacturer paying for registration
    * @param _deviceHashKey keccac256 hash of deviceId used as the key in devices mapping
    */
    event DeviceRegistered(address indexed _sender, bytes32 indexed _deviceHashKey);

    /*
    * @dev on failed registration
    * @param _sender manufacturer paying for registration
    * @param _deviceHashKey keccac256 hash of deviceId used as the key in devices mapping
    */
    event DeviceRegistrationFailed(address indexed _sender, bytes32 indexed _deviceHashKey);

    /*
    * @dev on successful activation
    * @param _sender manufacturer or device owner paying for activation.
    * @param _deviceHashKey keccac256 hash of deviceId used as the key in devices mapping
    */
    event DeviceActivated(address indexed _sender, bytes32 indexed deviceId);
    
    /*
    * @dev on successful addition of network member address
    * @param _sender IRN node sending the addition
    * @param _member address of added member
    * @param _memberId id of added member (e.g. manufacturer id), "" if not applicable
    */
    event NetworkMemberAdded(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /*
    * @dev on successful removal of network member address
    * @param _sender IRN node sending the removal
    * @param _member address of removed member
    * @param _memberId id of removed member (e.g. manufacturer id), "" if not applicable
    */
    event NetworkMemberRemoved(address indexed _sender, address indexed _member, bytes32 indexed _memberId);
    
    /*
    * @dev on successful withdrawal of ATMI from this contract to an IRN node
    * @param _sender IRN node requesting withdrawal
    * @param _amount withdrawal amount
    */
    event Withdrawal(address _sender, uint256 _amount);
    
    /*
    * @dev on reputation change for a device
    * @param _sender IRN node submitting the new reputation
    * @param _deviceId id of the target device
    * @param _newScore updated reputation score
    */
    event ReputationUpdated( address indexed _sender, bytes32 indexed _deviceId, bytes _newScore);

   /*
    * @dev on manufacturer address mapped to IRN address that registered the manufacturer's devices.
    * @param _sender address of the IRN node submitting the mapping
    * @param _irnNode address of the IRN node being mapped
    * @param _manufacturerId  manufacturer id
    */
    event ManufacturerMapped(address indexed _sender, address indexed _irnNode, bytes32 indexed _manufacturerId);

    /*
    * STATE VARIABLE SETTERS
    */
    /*
    * @dev sets the global activation fee
    * @param _activationFee
    */
    function setActivationFee (uint256 _activationFee) public onlyIRNorOwner {
        require(_activationFee > 0);
        activationFee = _activationFee;
    }

    /*
    * @dev sets the global registration fee
    * @param _registrationFee
    */
    function setRegistrationFee (uint256 _registrationFee) public onlyIRNorOwner {
        require(_registrationFee > 0);
        registrationFee = _registrationFee;
    }

    /*
    * @dev sets the global reputation reward to be paid out for a submitted reputation score
    * @param _reputationReward
    */
    function setReputationReward (uint256 _reputationReward) public onlyIRNorOwner {
        require(_reputationReward > 0);
        reputationReward = _reputationReward;
    }

    /*
    * DEVICE LOGIC
    */
    /*
    * @dev registers device with Atonomi by initialized the device and storing it on chain
    * @param _deviceIdHash keccak256 hash of the device's id
    * @param _hardwarePublicKey public key of the physical device
    */
    function registerDevice (bytes32 _deviceIdHash, bytes32 _hardwarePublicKey) public onlyManufacturer returns (bool) {
        require(_deviceIdHash != 0);
        require(_hardwarePublicKey != 0);

        bytes32 manufacturerId = network[msg.sender].memberId;
        address irnAddress = iRNLookup[manufacturerId];
        require(irnAddress != address(0));

        bool registered = true;
        bool activated = false;
        devices[_deviceIdHash] = Device(
            _hardwarePublicKey, 
            manufacturerId, 
            registered,
            activated,
            "");
        emit DeviceRegistered(msg.sender, _deviceIdHash);
        network[irnAddress].balance += registrationFee;

        require(token.transferFrom(msg.sender, address(this), registrationFee));
        return true;
    }

    /*
    * @dev registers two or more devices with Atonomi by initializing each device and storing it on chain
    * @param _deviceIdHashes array of keccak256 hashed ID's of each device
    * @param _hardwarePublicKeys arrauy of public keys of each physical device
    */
    function registerDevices  (bytes32[] _deviceIdHashes, bytes32[] _hardwarePublicKeys)
        public onlyManufacturer returns (bool)
    {
        require(_deviceIdHashes.length == _hardwarePublicKeys.length);

        uint256 runningBalance = 0;

        for (uint256 i = 0; i < _deviceIdHashes.length; i++) {

            bytes32 deviceIdHash = _deviceIdHashes[i];
            bytes32 hardwarePublicKey = _hardwarePublicKeys[i];

            if (deviceIdHash != 0 || hardwarePublicKey != 0) {
                emit DeviceRegistrationFailed(msg.sender, deviceIdHash);
                continue;
            }

            bytes32 manufacturerId = network[msg.sender].memberId;
            address irnAddress = iRNLookup[manufacturerId];
            if (irnAddress != address(0)) {
                emit DeviceRegistrationFailed(msg.sender, deviceIdHash);
                continue;
            }

            bool registered = true;
            bool activated = false;

            devices[deviceIdHash] = Device(
                hardwarePublicKey, 
                manufacturerId, 
                registered,
                activated,
                "");
            emit DeviceRegistered(msg.sender, deviceIdHash);
            runningBalance += registrationFee;

        }

        network[irnAddress].balance += runningBalance;

        require(token.transferFrom(msg.sender, address(this), runningBalance));
        return true;
    }

    /* 
    * @notice Activates the device
    * @dev device must be present in the registration mapping to be a candidate for activation
    * @param _deviceId id of the registered device to be activated
    */
    function activateDevice(bytes32 _deviceId) public returns (bool) {
        bytes32 deviceIdHash = keccak256(_deviceId);
        Device storage d = devices[deviceIdHash];
        require(d.registered);
        require(!d.activated);

        address irnAddress = iRNLookup[d.manufacturerId];
        require(irnAddress != address(0));

        d.activated = true;
        network[irnAddress].balance += activationFee;
        emit DeviceActivated(msg.sender, _deviceId);

        require(token.transferFrom(msg.sender, address(this), activationFee));
        return true;
    }

    /* 
    * @notice Registers and immediately activates device, used by manufacturers to prepay activation
    * @dev device must not already be present in either the registration mapping or the activation mapping
    * @param _deviceId id of the registered device to be activated
    * @param _hardwarePublicKey public key of the physical device
    * @param _manufacturerId manufacturer ID of the device
    */
    function registerAndActivateDevice (bytes32 _deviceId, bytes32 _hardwarePublicKey) 
        public onlyManufacturer returns (bool)
    {
        require(_deviceId != 0);
        require(_hardwarePublicKey != 0);

        bytes32 manufacturerId = network[msg.sender].memberId;
        address irnAddress = iRNLookup[manufacturerId];
        require(irnAddress != address(0));

        bytes32 deviceHashKey = keccak256(_deviceId);
        bool registered = true;
        bool activated = true;
        devices[deviceHashKey] = Device(
            _hardwarePublicKey, 
            manufacturerId, 
            registered, 
            activated, 
            "");
        emit DeviceRegistered(msg.sender, _deviceId);
        emit DeviceActivated(msg.sender, _deviceId);
        network[irnAddress].balance += (registrationFee + activationFee);

        require(token.transferFrom(msg.sender, address(this), registrationFee + activationFee));
        return true;
    }

    /*
    *REPUTATION MANAGEMENT
    */
    /*
    * @dev updates reputation for a device at the request of an IRN, only accessible
    * to IRN's whitelisted to edit reputation
    * @param _deviceId target device Id
    * @param _reputationScore updated reputation score computed by the IRN
    */
    function setReputation(bytes32 _deviceId, bytes _reputationScore) public onlyIRNNode {
        require(_reputationScore[0] != 0);
        require(devices[keccak256(_deviceId)].activated);
        require(token.transfer(msg.sender, reputationReward));
        emit ReputationUpdated(msg.sender, _deviceId, _reputationScore);
    }

    /*
    * WHITELIST ADD/REMOVE LOGIC
    */
    /*
     * @dev add a member to the network
     * @param _member address
     * @param _isIRNAdmin bool
     * @param _isManufacturer bool
     * @param _memberId bytes32
     * @return true if the address was added to the network,
     * false if the address was already in the network
    */ 
    function addNetworkMember(address _member, bool _isIRNAdmin, bool _isManufacturer,
        bool _isIRNNode, bytes32 _memberId) public onlyIRNorOwner returns(bool)
    {
        require(!network[_member].isIRNAdmin);
        require(!network[_member].isManufacturer);
        require(!network[_member].isIRNNode);
        require(network[_member].memberId == 0);

        network[_member] = NetworkMember(
            _isIRNAdmin,
            _isManufacturer,
            _isIRNNode,
            _memberId, 0);
        emit NetworkMemberAdded(msg.sender, _member, _memberId);

        return true;
    }

    /*
    * @dev remove a member from the network
    * @param _member address
    * @return true if the address was removed from the network,
    * false if the address wasn't in the network in the first place
    */ 
    function removeNetworkMember(address _member) public onlyIRNorOwner returns(bool) {
        bytes32 memberId = network[_member].memberId;
        delete network[_member];
        emit NetworkMemberRemoved(msg.sender, _member, memberId);
        return true;
    }

    /*
    * @dev creates a mapping between an IRN node, and the address of a manufacturer for
    * whom the IRN node handles registrations
    * @param _member address of IRN node
    * @param _memberId manufacturer ID
    * @return returns true if successfully mapped
    */ 
    function mapManufacturerToIRNNode(address _member, bytes32 _memberId)
        public onlyIRNorOwner returns (bool)
    {
        require(_memberId != 0);
        require(network[_member].isIRNNode);

        iRNLookup[_memberId] = _member;
        emit ManufacturerMapped(msg.sender, _member, _memberId);

        return true;
    }

    /* 
    * @notice withdraw fund accumulated in the contract to an Atonomi or partner IRN wallet
    * @dev accessible to the owner of the contract only
    * @param _amount uint256 withdrawal amount
    */
    function withdraw(uint256 _amount) public onlyOwner returns (bool) {
        require(network[msg.sender].isIRNNode);
        require(network[msg.sender].balance >= _amount);

        emit Withdrawal(msg.sender, _amount);
        require(token.transferFrom(msg.sender, address(this), _amount));
        return true;
    }
}
