pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/Ownership/Ownable.sol";


/// @title ERC-20 Token Standard
/// @author Fabian Vogelsteller <fabian@ethereum.org>, Vitalik Buterin <vitalik.buterin@ethereum.org>
/// @dev https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md
interface ERC20Interface {
    function totalSupply() public constant returns (uint);
    function balanceOf(address tokenOwner) public constant returns (uint balance);
    function allowance(address tokenOwner, address spender) public constant returns (uint remaining);
    function transfer(address to, uint tokens) public returns (bool success);
    function approve(address spender, uint tokens) public returns (bool success);
    function transferFrom(address from, address to, uint tokens) public returns (bool success);

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}


/// @title Atonomi Smart Contract
/// @author Atonomi, LLC
/// @notice Governs the activation, registration, and reputation of devices on the Atonomi network
/// @dev Ownable source: https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/ownership/Ownable.sol
/// @dev Owner governs the access of Atonomi Admins on the network
contract Atonomi is Ownable {
    ///
    /// STATE VARIABLES
    ///
    /// @title Registration Fee
    /// @notice Manufacturer pays token to register a device
    /// @notice IRN Node of the manufacturer receives token as payment
    uint256 public registrationFee;

    /// @title Activiation Fee
    /// @notice Manufacturer or Device Owner pays token to activate device
    /// @notice IRN Node of the manufacturer receives token as payment
    uint256 public activationFee;

    /// @title Reputation Reward
    /// @notice Repuation Auditor/Validator recieves token for contributing reputation score
    /// @notice IRN Node of the manufacturer pays token to reward contributors
    uint256 public reputationReward;

    /// @title ATMI Token
    /// @notice Standard ERC20 Token
    /// @dev AMLToken source: https://github.com/TokenMarketNet/ico/blob/master/contracts/AMLToken.sol
    /// @dev AMLToken also implements ERC827 spec, to help the front-end GUI combine approve + transfer in one call
    ERC20Interface public token;

    ///
    /// STORAGE MAPPINGS 
    ///
    /// @title Atonomi Devices registry
    /// @notice Contains all devices participating in the Atonomi Network
    /// @dev Key is a secret hash of the device id
    /// @dev Value is a struct that contains the device status and metadata
    mapping (bytes32 => Device) public devices;

    /// @title Atonomi Participant whitelist
    /// @notice Contains all the network participants
    /// @dev Atonomi Admins: Govern the access to manufacturers and IRN Nodes on the network
    /// @dev IRN Nodes: Governs repuration score data of devices
    /// @dev Manufacturers: Governs devices on the network
    /// @dev Key is ethereum account of the participant
    /// @dev Value is a struct that contains the role of the participant
    mapping (address => NetworkMember) public network;

    /// @title IRN Node Lookup
    /// @notice Lookup to see what IRN Node a Manufacturer belongs to
    /// @dev Key is the manufacturer id
    /// @dev Value is the ethereum account of the IRN Node
    mapping (bytes32 => address) public iRNLookup;

    ///
    /// TYPES 
    ///
    /// @title Atonomi Device
    /// @notice Contains the device state on the Atonomi network
    /// @dev hardwarePublicKey is used for validation between devices
    /// @dev manufacturerId is the manufacturer the device belongs to
    /// @dev registered is true when device is registered, otherwise false
    /// @dev activated is true when device is activated, otherwise false
    /// @dev reputationScore is official Atonomi Reputation score for the device
    struct Device {
        bytes32 hardwarePublicKey;
        bytes32 manufacturerId;
        bool registered;
        bool activated;
        bytes32 reputationScore;
    }

    /// @title Atonomi Network Participant
    /// @notice Contains role information for a participant
    /// @dev isIRNAdmin is true if participant is an IRN Admin, otherwise false
    /// @dev isManufacturer is true if participant is a Manufacturer, otherwise false
    /// @dev isIRNNode is true if participant is an IRN Node, otherwise false
    /// @dev memberId is the manufacturer id, for all other participants this will be 0
    struct NetworkMember {
        bool isIRNAdmin;
        bool isManufacturer;
        bool isIRNNode;
        bytes32 memberId;
    }

    ///
    /// MODIFIERS
    ///
    /// @notice only manufacturers can call, otherwise throw
    modifier onlyManufacturer() {
        require(network[msg.sender].isManufacturer);
        _;
    }

    /// @notice only IRNAdmins or Owner can call, otherwise throw
    modifier onlyIRNorOwner() {
        require(msg.sender == owner || network[msg.sender].isIRNAdmin);
        _;
    }

    /// @notice only IRN Nodes can call, otherwise throw
    modifier onlyIRNNode() {
        require(network[msg.sender].isIRNNode);
        _;
    }

    /// @notice only the ERC Token can call, otherwise throw
    /// @dev Used by ERC827 functions such as approve(address,uint256,bytes)
    modifier onlyERCToken() {
        require(msg.sender == address(token));
        _;
    }

    /// @notice Constructor sets the ERC Token contract and initial values for network fees
    /// @param _token is the Atonomi Token contract address
    /// @param _registrationFee initial registration fee on the network
    /// @param _activationFee initial activation fee on the network
    /// @param _reputationReward initial reputation reward on the network
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

    ///
    /// EVENTS 
    ///
    /// @notice emitted on successful device registration
    /// @param _sender manufacturer paying for registration
    /// @param _beneficiary irn node of the device manufacturer
    /// @param _deviceHashKey hash of device id used as the key in devices mapping
    event DeviceRegistered(address indexed _sender, address indexed _beneficiary, bytes32 indexed _deviceHashKey);

    /// @notice emitted on failed device registrations during bulk registration
    /// @param _sender manufacturer paying for registration
    /// @param _beneficiary irn node of the device manufacturer
    /// @param _deviceHashKey keccac256 hash of deviceId used as the key in devices mapping
    event DeviceRegistrationFailed(address indexed _sender, address indexed _beneficiary,
        bytes32 indexed _deviceHashKey);

    /// @notice emitted on successful device activation
    /// @param _sender manufacturer or device owner paying for activation.
    /// @param _beneficiary irn node of the device manufacturer
    /// @param _deviceId the real device id (only revealed after activation)
    event DeviceActivated(address indexed _sender, address indexed _beneficiary, bytes32 indexed _deviceId);

    /// @notice emitted on successful addition of network member address
    /// @param _sender IRN node sending the addition
    /// @param _member address of added member
    /// @param _memberId id of added member (e.g. manufacturer id), "" if not applicable
    event NetworkMemberAdded(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /// @notice emitted on successful removal of network member address
    /// @param _sender IRN node sending the addition
    /// @param _member address of added member
    /// @param _memberId id of added member (e.g. manufacturer id), "" if not applicable
    event NetworkMemberRemoved(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /// @notice emitted on reputation change for a device
    /// @param _sender IRN node submitting the new reputation
    /// @param _deviceId id of the target device
    /// @param _newScore updated reputation score
    /// @param _beneficiary Auditor or Validator who contributed to score
    event ReputationScoreUpdated(address indexed _sender, bytes32 indexed _deviceId,
        bytes32 _newScore, address indexed _beneficiary);

    /// @notice emitted on manufacturer address mapped to IRN address that registered the manufacturer's devices.
    /// @param _sender address of the IRN Admin submitting the mapping
    /// @param _irnNode address of the IRN node being mapped
    /// @param _manufacturerId manufacturer being mapped
    event ManufacturerMapped(address indexed _sender, address indexed _irnNode, bytes32 indexed _manufacturerId);

    /// @notice emitted everytime the activation fee changes
    /// @param _sender ethereum address of IRN Admin that made the change
    /// @param _amount new fee value in ATMI tokens
    event ActivationFeeUpdated(address indexed _sender, uint256 _amount);

    /// @notice emitted everytime the registration fee changes
    /// @param _sender ethereum address of IRN Admin that made the change
    /// @param _amount new fee value in ATMI tokens
    event RegistrationFeeUpdated(address indexed _sender, uint256 _amount);

    /// @notice emitted everytime the reputation reward changes
    /// @param _sender ethereum address of IRN Admin that made the change
    /// @param _amount new fee value in ATMI tokens
    event ReputationRewardUpdated(address indexed _sender, uint256 _amount);

    ///
    /// FEE SETTERS
    ///
    /// @notice sets the global activation fee
    /// @param _activationFee new fee for activations in ATIM tokens
    /// @return true if successful, otherwise false
    function setActivationFee (uint256 _activationFee) public onlyIRNorOwner returns (bool) {
        require(_activationFee > 0);
        require(_activationFee != activationFee);
        activationFee = _activationFee;
        emit ActivationFeeUpdated(msg.sender, _activationFee);
        return true;
    }

    /// @notice sets the global registration fee
    /// @param _registrationFee new fee for registrations in ATIM tokens
    /// @return true if successful, otherwise false
    function setRegistrationFee (uint256 _registrationFee) public onlyIRNorOwner returns (bool) {
        require(_registrationFee > 0);
        require(_registrationFee != registrationFee);
        registrationFee = _registrationFee;
        emit RegistrationFeeUpdated(msg.sender, _registrationFee);
        return true;
    }

    /// @notice sets the global reputation reward
    /// @param _reputationReward new reward for reputation score changes in ATIM tokens
    /// @return true if successful, otherwise false
    function setReputationReward (uint256 _reputationReward) public onlyIRNorOwner returns (bool) {
        require(_reputationReward > 0);
        require(_reputationReward != reputationReward);
        reputationReward = _reputationReward;
        emit ReputationRewardUpdated(msg.sender, _reputationReward);
        return true;
    }

    ///
    /// DEVICE ONBOARDING
    ///
    /// @notice registers device on the Atonomi network
    /// @param _deviceIdHash secret hash of the device's id (needs to be hashed by caller)
    /// @param _hardwarePublicKey public key of the physical device used for validation
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer to the IRN Node they belong to
    function registerDevice(bytes32 _deviceIdHash, bytes32 _hardwarePublicKey) public onlyManufacturer returns (bool) {
        require(_deviceIdHash != 0);
        require(_hardwarePublicKey != 0);
        require(!devices[_deviceIdHash].registered);
        require(!devices[_deviceIdHash].activated);

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
        emit DeviceRegistered(msg.sender, irnAddress, _deviceIdHash);

        require(token.transferFrom(msg.sender, irnAddress, registrationFee));
        return true;
    }

    /// @notice registers device on the Atonomi network
    /// @param _mfg ethereum address of the manufacturer registering the device
    /// @param _deviceIdHash secret hash of the device's id (needs to be hashed by caller)
    /// @param _hardwarePublicKey public key of the physical device used for validation
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the token contract implementing ERC827
    /// @dev token contract should call approve with registerDevice827 as the data in callback
    /// @dev tokens will be deducted from the manufacturer to the IRN Node they belong to
    function registerDevice827(address _mfg, bytes32 _deviceIdHash, bytes32 _hardwarePublicKey) 
        public onlyERCToken returns (bool) {
        // take note of new modifier
        // is it safe to pass mfg in as param, if we trust msg.sender is token?
        // i think so, since token is set by owner
        require(network[_mfg].isManufacturer);

        require(_deviceIdHash != 0);
        require(_hardwarePublicKey != 0);
        require(!devices[_deviceIdHash].registered);
        require(!devices[_deviceIdHash].activated);
        
        bytes32 manufacturerId = network[_mfg].memberId;
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
        emit DeviceRegistered(_mfg, irnAddress, _deviceIdHash);

        // could use ERC827 transfer here but i couldnt see a way to confirm payment was actualy made
        // with approve 827 version, if someone trys to manipulate the mfg input param, we are still protected
        // as the spender still needs to set approval, otherwise this will throw
        require(token.transferFrom(_mfg, irnAddress, registrationFee));
        return true;
    }

    /// @notice registers multiple devices on the Atonomi network
    /// @param _deviceIdHashes array of secret hashed ID's of each device
    /// @param _hardwarePublicKeys array of public keys of each physical device
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer to the IRN Node they belong to
    function registerDevices(bytes32[] _deviceIdHashes, bytes32[] _hardwarePublicKeys)
        public onlyManufacturer returns (bool)
    {
        require(_deviceIdHashes.length == _hardwarePublicKeys.length);

        bytes32 manufacturerId = network[msg.sender].memberId;
        address irnAddress = iRNLookup[manufacturerId];
        require(irnAddress != address(0));

        uint256 runningBalance = 0;
        for (uint256 i = 0; i < _deviceIdHashes.length; i++) {

            bytes32 deviceIdHash = _deviceIdHashes[i];
            bytes32 hardwarePublicKey = _hardwarePublicKeys[i];

            if (deviceIdHash != 0 || hardwarePublicKey != 0) {
                emit DeviceRegistrationFailed(msg.sender, irnAddress, deviceIdHash);
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
            emit DeviceRegistered(msg.sender, irnAddress, deviceIdHash);
            runningBalance += registrationFee;

        }

        require(token.transferFrom(msg.sender, irnAddress, runningBalance));
        return true;
    }

    /// @notice Activates the device
    /// @param _deviceId id of the real device id to be activated (not the has of the device id)
    /// @return true if successful, otherwise false
    /// @dev if the hash doesnt match, the device is considered not registered and will throw
    /// @dev anyone with the device id (in hand) is considered the device owner
    /// @dev tokens will be deducted from the device owner to the IRN Node the device belongs to
    function activateDevice(bytes32 _deviceId) public returns (bool) {
        bytes32 deviceIdHash = keccak256(_deviceId);
        Device storage d = devices[deviceIdHash];
        require(d.registered);
        require(!d.activated);

        address irnAddress = iRNLookup[d.manufacturerId];
        require(irnAddress != address(0));

        d.activated = true;
        emit DeviceActivated(msg.sender, irnAddress, _deviceId);

        require(token.transferFrom(msg.sender, irnAddress, activationFee));
        return true;
    }

    /// @notice Registers and immediately activates device, used by manufacturers to prepay activation
    /// @param _deviceId id of the real device id to be activated (not the has of the device id)
    /// @param _hardwarePublicKey public key of the physical device used for validation
    /// @return true if successful, otherwise false
    /// @dev since the manufacturer is trusted, no need for the caller to hash the device id
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer to the IRN Node the device belongs to
    function registerAndActivateDevice (bytes32 _deviceId, bytes32 _hardwarePublicKey) 
        public onlyManufacturer returns (bool)
    {
        require(_deviceId != 0);
        require(_hardwarePublicKey != 0);

        bytes32 deviceIdHash = keccak256(_deviceId);
        require(!devices[deviceIdHash].registered);
        require(!devices[deviceIdHash].activated);

        bytes32 manufacturerId = network[msg.sender].memberId;
        address irnAddress = iRNLookup[manufacturerId];
        require(irnAddress != address(0));

        bool registered = true;
        bool activated = true;
        devices[deviceIdHash] = Device(
            _hardwarePublicKey, 
            manufacturerId, 
            registered, 
            activated, 
            "");
        emit DeviceRegistered(msg.sender, irnAddress, deviceIdHash);
        emit DeviceActivated(msg.sender, irnAddress, _deviceId);

        require(token.transferFrom(msg.sender, irnAddress, registrationFee + activationFee));
        return true;
    }

    ///
    /// REPUTATION MANAGEMENT
    ///
    /// @notice updates reputation for a device
    /// @param _deviceId target device Id
    /// @param _reputationScore updated reputation score computed by the IRN
    /// @param _beneficiary who is rewarded tokens for contributing
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be an irn node
    /// @dev tokens will be deducted from the IRN Node to the beneficiary who wrote the score
    function updateReputationScore(bytes32 _deviceId, bytes32 _reputationScore, address _beneficiary)
        public onlyIRNNode returns (bool)
    {
        require(_beneficiary != address(0));

        bytes32 key = keccak256(_deviceId);
        Device storage d = devices[key];
        require(d.activated);

        d.reputationScore = _reputationScore;
        emit ReputationScoreUpdated(msg.sender, _deviceId, _reputationScore, _beneficiary);

        require(token.transferFrom(msg.sender, _beneficiary, reputationReward));
        return true;
    }

    ///
    /// WHITELIST PARTICIPANT MANAGEMENT
    ///
    /// @notice add a member to the network
    /// @param _member ethereum address of member to be added
    /// @param _isIRNAdmin true if an irn admin, otherwise false
    /// @param _isManufacturer true if an manufactuter, otherwise false
    /// @param _memberId is manufactuer id, if _isManufacturer is true, otherwise 0
    /// @return true if successful, otherwise false
    /// @dev _memberId is only relevant for manufacturer, but is flexible to allow use for other purposes
    /// @dev msg.sender is expected to be either owner or irn admin
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
            _memberId);
        emit NetworkMemberAdded(msg.sender, _member, _memberId);

        return true;
    }

    /// @notice remove a member to the network
    /// @param _member ethereum address of member to be added
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be either owner or irn admin
    function removeNetworkMember(address _member) public onlyIRNorOwner returns(bool) {
        bytes32 memberId = network[_member].memberId;
        delete network[_member];
        emit NetworkMemberRemoved(msg.sender, _member, memberId);
        return true;
    }

    /// @notice creates a mapping between an IRN node, and the address of a manufacturer
    /// @param _member ethereum address of member to be added
    /// @param _memberId is manufactuer id
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be either owner or irn admin
    function mapManufacturerToIRNNode(address _member, bytes32 _memberId)
        public onlyIRNorOwner returns (bool)
    {
        require(_memberId != 0);
        require(network[_member].isIRNNode);

        iRNLookup[_memberId] = _member;
        emit ManufacturerMapped(msg.sender, _member, _memberId);

        return true;
    }
}
