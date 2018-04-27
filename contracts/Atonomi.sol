pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zeppelin-solidity/contracts/lifecycle/TokenDestructible.sol";


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


/// @title Safe Math library
/// @dev Math operations with safety checks that throw on error
/// @dev https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/math/SafeMath.sol
library SafeMath {
    /// @dev Multiplies two numbers, throws on overflow.
    function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a == 0) {
            return 0;
        }
        c = a * b;
        assert(c / a == b);
        return c;
    }

    /// @dev Integer division of two numbers, truncating the quotient.
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        // uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return a / b;
    }

    /// @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    /// @dev Adds two numbers, throws on overflow.
    function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = a + b;
        assert(c >= a);
        return c;
    }
}


/// @title Atonomi Smart Contract
/// @author Atonomi
/// @notice Governs the activation, registration, and reputation of devices on the Atonomi network
/// @dev Ownable: Owner governs the access of Atonomi Admins, Fees, and Rewards on the network
/// @dev Pausable: Gives ability for Owner to pull emergency stop to prevent actions on the network
/// @dev TokenDestructible: Gives owner ability to kill the contract and extract funds to a new contract
contract Atonomi is Pausable, TokenDestructible {
    using SafeMath for uint256;

    ///
    /// STATE VARIABLES
    ///
    /// @title Registration Fee
    /// @notice Manufacturer pays token to register a device
    /// @notice Manufacturer will recieve a share in any reputation updates for a device
    uint256 public registrationFee;

    /// @title Activiation Fee
    /// @notice Manufacturer or Device Owner pays token to activate device
    uint256 public activationFee;

    /// @title Reputation Reward
    /// @notice Reputation Auditor/Validator receives token for contributing reputation score
    uint256 public reputationReward;

    /// @title Reputation Token Share
    /// @notice percentage that the irn node or auditor receives (remaining goes to manufacturer)
    uint256 public reputationTokenShare;

    /// @title ATMI Token
    /// @notice Standard ERC20 Token
    /// @dev AMLToken source: https://github.com/TokenMarketNet/ico/blob/master/contracts/AMLToken.sol
    ERC20Interface public token;

    ///
    /// STORAGE MAPPINGS 
    ///
    /// @title Atonomi Devices registry
    /// @notice Contains all devices participating in the Atonomi Network
    /// @dev Key is a keccak256 hash of the device id
    /// @dev Value is a struct that contains the device status and metadata
    mapping (bytes32 => Device) public devices;

    /// @title Atonomi Participant whitelist
    /// @notice Contains all the network participants
    /// @dev Atonomi Admins: Govern the access to manufacturers and IRN Nodes on the network
    /// @dev IRN Nodes: Governs reputation score data of devices
    /// @dev Manufacturers: Governs devices on the network
    /// @dev Key is ethereum account of the participant
    /// @dev Value is a struct that contains the role of the participant
    mapping (address => NetworkMember) public network;

    /// @title Reward Balances
    /// @notice balances of rewards that are able to be claimed by participants
    /// @dev Key is ethereum account of the owner of the tokens
    /// @dev Value is tokens available for withdraw
    mapping (address => uint256) public balances;

    ///
    /// TYPES 
    ///
    /// @title Atonomi Device
    /// @notice Contains the device state on the Atonomi network
    /// @dev manufacturerId is the manufacturer the device belongs to
    /// @dev deviceType is the type of device categorized by the manufacturer
    /// @dev registered is true when device is registered, otherwise false
    /// @dev activated is true when device is activated, otherwise false
    /// @dev reputationScore is official Atonomi Reputation score for the device
    /// @dev registeredBy manufacturer to be rewarded tokens for reputation updates
    struct Device {
        bytes32 manufacturerId;
        bytes32 deviceType;
        bool registered;
        bool activated;
        bytes32 reputationScore;
        address registeredBy;
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
        require(network[msg.sender].isManufacturer, "must be a manufacturer");
        _;
    }

    /// @notice only IRNAdmins or Owner can call, otherwise throw
    modifier onlyIRNorOwner() {
        require(msg.sender == owner || network[msg.sender].isIRNAdmin, "must be owner or an irn admin");
        _;
    }

    /// @notice only IRN Nodes can call, otherwise throw
    modifier onlyIRNNode() {
        require(network[msg.sender].isIRNNode, "must be an irn node");
        _;
    }

    /// @notice Constructor sets the ERC Token contract and initial values for network fees
    /// @param _token is the Atonomi Token contract address (must be ERC20)
    /// @param _registrationFee initial registration fee on the network
    /// @param _activationFee initial activation fee on the network
    /// @param _reputationReward initial reputation reward on the network
    function Atonomi(address _token, uint256 _registrationFee, uint256 _activationFee, uint256 _reputationReward)
        public 
    {
        require(_token != address(0), "token address cannot be 0x0");
        require(_activationFee > 0, "activation fee must be greater than 0");
        require(_registrationFee > 0, "registration fee must be greater than 0");
        require(_reputationReward > 0, "reputation reward must be greater than 0");

        token = ERC20Interface(_token);
        activationFee = _activationFee;
        registrationFee = _registrationFee;
        reputationReward = _reputationReward;
        reputationTokenShare = 80;
    }

    ///
    /// EVENTS 
    ///
    /// @notice emitted on successful device registration
    /// @param _sender manufacturer paying for registration
    /// @param _fee registration fee paid by manufacturer
    /// @param _deviceHashKey keccak256 hash of device id used as the key in devices mapping
    /// @param _deviceType is the type of device categorized by the manufacturer
    event DeviceRegistered(address indexed _sender, uint256 _fee, bytes32 indexed _deviceHashKey,
        bytes32 indexed _deviceType);

    /// @notice emitted on successful device activation
    /// @param _sender manufacturer or device owner paying for activation
    /// @param _fee registration fee paid by manufacturer
    /// @param _deviceId the real device id (only revealed after activation)
    /// @param _deviceType is the type of device categorized by the manufacturer
    event DeviceActivated(address indexed _sender, uint256 _fee, bytes32 indexed _deviceId,
        bytes32 indexed _deviceType);

    /// @notice emitted on successful addition of network member address
    /// @param _sender ethereum account of participant that made the change
    /// @param _member address of added member
    /// @param _memberId manufacturer id for manufacturer, otherwise 0x0
    event NetworkMemberAdded(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /// @notice emitted on successful removal of network member address
    /// @param _sender ethereum account of participant that made the change
    /// @param _member address of removed member
    /// @param _memberId manufacturer id for manufacturer, otherwise 0x0
    event NetworkMemberRemoved(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /// @notice emitted on reputation change for a device
    /// @param _deviceId device id of the target device
    /// @param _deviceType is the type of device categorized by the manufacturer
    /// @param _newScore updated reputation score
    /// @param _irnNode IRN node submitting the new reputation
    /// @param _irnReward tokens awarded to irn node
    /// @param _manufacturerWallet manufacturer associated with the device is rewared a share of tokens
    /// @param _manufacturerReward tokens awarded to contributor
    event ReputationScoreUpdated(bytes32 indexed _deviceId, bytes32 indexed _deviceType, bytes32 _newScore,
        address _irnNode, uint256 _irnReward, address indexed _manufacturerWallet, uint256 _manufacturerReward);

    /// @notice emitted everytime the activation fee changes
    /// @param _sender ethereum account of participant that made the change
    /// @param _amount new fee value in ATMI tokens
    event ActivationFeeUpdated(address indexed _sender, uint256 _amount);

    /// @notice emitted everytime the registration fee changes
    /// @param _sender ethereum account of participant that made the change
    /// @param _amount new fee value in ATMI tokens
    event RegistrationFeeUpdated(address indexed _sender, uint256 _amount);

    /// @notice emitted everytime the reputation reward changes
    /// @param _sender ethereum account of participant that made the change
    /// @param _amount new fee value in ATMI tokens
    event ReputationRewardUpdated(address indexed _sender, uint256 _amount);

    /// @notice emitted everytime a participant withdraws from token pool
    /// @param _sender ethereum account of participant that made the change
    /// @param _amount tokens withdrawn
    event TokensWithdrawn(address indexed _sender, uint256 _amount);

    /// @notice emitted everytime owner rewards a network participant
    /// @param _sender ethereum account of participant that made the change
    /// @param _contributor ethereum address of participant to be rewarded
    /// @param _amount the amount of rewarded tokens
    event ContributorRewarded(address indexed _sender, address indexed _contributor, uint256 _amount);

    /// @notice emitted everytime owner changes the contributation share for reputation authors
    /// @param _sender ethereum account of participant that made the change
    /// @param _percentage new percentage value
    event ReputationTokenShareUpdated(address indexed _sender, uint256 _percentage);

    ///
    /// FEE SETTERS
    ///
    /// @notice sets the global activation fee
    /// @param _activationFee new fee for activations in ATMI tokens
    /// @return true if successful, otherwise false
    function setActivationFee(uint256 _activationFee) public onlyOwner returns (bool) {
        require(_activationFee > 0, "new activation fee must be greater than zero");
        require(_activationFee != activationFee, "new activation fee must be different");
        activationFee = _activationFee;
        emit ActivationFeeUpdated(msg.sender, _activationFee);
        return true;
    }

    /// @notice sets the global registration fee
    /// @param _registrationFee new fee for registrations in ATMI tokens
    /// @return true if successful, otherwise false
    function setRegistrationFee(uint256 _registrationFee) public onlyOwner returns (bool) {
        require(_registrationFee > 0, "new registration fee must be greater than zero");
        require(_registrationFee != registrationFee, "new registration fee must be different");
        registrationFee = _registrationFee;
        emit RegistrationFeeUpdated(msg.sender, _registrationFee);
        return true;
    }

    /// @notice sets the global reputation reward
    /// @param _reputationReward new reward for reputation score changes in ATMI tokens
    /// @return true if successful, otherwise false
    function setReputationReward(uint256 _reputationReward) public onlyOwner returns (bool) {
        require(_reputationReward > 0, "new reputation reward must be greater than zero");
        require(_reputationReward != reputationReward, "new reputation reward must be different");
        reputationReward = _reputationReward;
        emit ReputationRewardUpdated(msg.sender, _reputationReward);
        return true;
    }

    /// @notice sets the global reputation reward share allotted to the authors and manufacturers
    /// @param _reputationTokenShare new percentage of the reputation reward allotted to author
    /// @return true if successful, otherwise false
    function setReputationTokenShare(uint256 _reputationTokenShare) public onlyOwner returns (bool) {
        require(_reputationTokenShare > 0, "new share must be larger than zero");
        require(_reputationTokenShare <= 100, "new share must be less than or equal to 100");
        require(reputationTokenShare != _reputationTokenShare, "new share must be different");
        reputationTokenShare = _reputationTokenShare;
        emit ReputationTokenShareUpdated(msg.sender, _reputationTokenShare);
        return true;
    }

    /// @notice computes the portion of the reputation reward allotted to the mfg and author
    /// @return irnReward and mfgReward
    function getReputationRewards() public view returns (uint256 irnReward, uint256 mfgReward) {
        irnReward = reputationReward.mul(reputationTokenShare).div(100);
        mfgReward = reputationReward.sub(irnReward);
    }

    ///
    /// DEVICE ONBOARDING
    ///
    /// @notice registers device on the Atonomi network
    /// @param _deviceIdHash keccak256 hash of the device's id (needs to be hashed by caller)
    /// @param _deviceType is the type of device categorized by the manufacturer
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer and added to the token pool
    /// @dev owner has ability to pause this operation
    function registerDevice(bytes32 _deviceIdHash, bytes32 _deviceType)
        public onlyManufacturer whenNotPaused returns (bool)
    {
        validateAndRegisterDevice(msg.sender, _deviceIdHash, _deviceType);
        emit DeviceRegistered(msg.sender, registrationFee, _deviceIdHash, _deviceType);
        require(token.transferFrom(msg.sender, address(this), registrationFee), "transferFrom failed");
        return true;
    }

    /// @notice Activates the device
    /// @param _deviceId id of the real device id to be activated (not the hash of the device id)
    /// @return true if successful, otherwise false
    /// @dev if the hash doesnt match, the device is considered not registered and will throw
    /// @dev anyone with the device id (in hand) is considered the device owner
    /// @dev tokens will be deducted from the device owner and added to the token pool
    /// @dev owner has ability to pause this operation
    function activateDevice(bytes32 _deviceId) public whenNotPaused returns (bool) {
        validateAndActivateDevice(_deviceId);
        emit DeviceActivated(msg.sender, activationFee, _deviceId, devices[keccak256(_deviceId)].deviceType);
        require(token.transferFrom(msg.sender, address(this), activationFee), "transferFrom failed");
        return true;
    }

    /// @notice Registers and immediately activates device, used by manufacturers to prepay activation
    /// @param _deviceId id of the real device id to be activated (not the has of the device id)
    /// @param _deviceType is the type of device categorized by the manufacturer
    /// @return true if successful, otherwise false
    /// @dev since the manufacturer is trusted, no need for the caller to hash the device id
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer and added to the token pool
    /// @dev owner has ability to pause this operation
    function registerAndActivateDevice(bytes32 _deviceId, bytes32 _deviceType) 
        public onlyManufacturer whenNotPaused returns (bool)
    {
        bytes32 deviceIdHash = keccak256(_deviceId);
        validateAndRegisterDevice(msg.sender, deviceIdHash, _deviceType);
        emit DeviceRegistered(msg.sender, registrationFee, deviceIdHash, _deviceType);

        validateAndActivateDevice(_deviceId);
        emit DeviceActivated(msg.sender, activationFee, _deviceId, _deviceType);

        uint256 fee = registrationFee.add(activationFee);
        require(token.transferFrom(msg.sender, address(this), fee), "transferFrom failed");
        return true;
    }

    ///
    /// REPUTATION MANAGEMENT
    ///
    /// @notice updates reputation for a device
    /// @param _deviceId target device Id
    /// @param _reputationScore updated reputation score computed by the author
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the reputation author (either irn node or the reputation auditor)
    /// @dev tokens will be deducted from the contract pool
    /// @dev author and manufacturer will be rewarded a split of the tokens
    /// @dev owner has ability to pause this operation
    function updateReputationScore(bytes32 _deviceId, bytes32 _reputationScore)
        public onlyIRNNode whenNotPaused returns (bool)
    {
        validateAndUpdateReputation(_deviceId, _reputationScore);

        Device memory d = devices[keccak256(_deviceId)];
        address _manufacturerWallet = d.registeredBy;
        require(_manufacturerWallet != address(0), "_mfgWallet cannot be 0x0");

        uint256 irnReward;
        uint256 manufacturerReward;
        (irnReward, manufacturerReward) = getReputationRewards();
        distributeRewards(msg.sender, irnReward);
        distributeRewards(_manufacturerWallet, manufacturerReward);
        emit ReputationScoreUpdated(_deviceId, d.deviceType, _reputationScore,
            msg.sender, irnReward, _manufacturerWallet, manufacturerReward);
        return true;
    }

    ///
    /// BULK OPERATIONS
    ///
    /// @notice registers multiple devices on the Atonomi network
    /// @param _deviceIdHashes array of keccak256 hashed ID's of each device
    /// @param _deviceTypes array of types of device categorized by the manufacturer
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer and added to the token pool
    /// @dev owner has ability to pause this operation
    function registerDevices(bytes32[] _deviceIdHashes, bytes32[] _deviceTypes)
        public onlyManufacturer whenNotPaused returns (bool)
    {
        require(_deviceIdHashes.length > 0, "No devices were found");
        require(_deviceIdHashes.length == _deviceTypes.length, "device type array needs to be same size");

        uint256 runningBalance = 0;
        for (uint256 i = 0; i < _deviceIdHashes.length; i++) {
            bytes32 deviceIdHash = _deviceIdHashes[i];
            bytes32 deviceType = _deviceTypes[i];
            if (deviceIdHash == 0 || deviceType == 0) {
                revert("invalid device");
            }

            Device memory d = devices[deviceIdHash];
            if (d.registered || d.activated) {
                revert("device is already registered or activated");
            }

            validateAndRegisterDevice(msg.sender, deviceIdHash, deviceType);
            emit DeviceRegistered(msg.sender, registrationFee, deviceIdHash, deviceType);

            runningBalance = runningBalance.add(registrationFee);
        }

        require(token.transferFrom(msg.sender, address(this), runningBalance), "transferFrom failed");
        return true;
    }

    ///
    /// WHITELIST PARTICIPANT MANAGEMENT
    ///
    /// @notice add a member to the network
    /// @param _member ethereum address of member to be added
    /// @param _isIRNAdmin true if an irn admin, otherwise false
    /// @param _isManufacturer true if an manufactuter, otherwise false
    /// @param _memberId manufacturer id for manufacturers, otherwise 0x0
    /// @return true if successful, otherwise false
    /// @dev _memberId is only relevant for manufacturer, but is flexible to allow use for other purposes
    /// @dev msg.sender is expected to be either owner or irn admin
    function addNetworkMember(address _member, bool _isIRNAdmin, bool _isManufacturer,
        bool _isIRNNode, bytes32 _memberId) public onlyIRNorOwner returns(bool)
    {
        require(!network[_member].isIRNAdmin, "already an irn admin");
        require(!network[_member].isManufacturer, "already a manufacturer");
        require(!network[_member].isIRNNode, "already an irn node");
        require(network[_member].memberId == 0, "already assigned a member id");

        network[_member] = NetworkMember(
            _isIRNAdmin,
            _isManufacturer,
            _isIRNNode,
            _memberId);

        emit NetworkMemberAdded(msg.sender, _member, _memberId);

        return true;
    }

    /// @notice remove a member to the network
    /// @param _member ethereum address of member to be removed
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be either owner or irn admin
    function removeNetworkMember(address _member) public onlyIRNorOwner returns(bool) {
        bytes32 memberId = network[_member].memberId;
        delete network[_member];
        emit NetworkMemberRemoved(msg.sender, _member, memberId);
        return true;
    }

    ///
    /// TOKEN REWARDS
    ///
    /// @notice allows participants in the Atonomi network to claim their rewards
    /// @return true if successful, otherwise false
    /// @dev owner has ability to pause this operation
    function withdrawTokens() public whenNotPaused returns (bool) {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "amount is zero");

        balances[msg.sender] = 0;
        emit TokensWithdrawn(msg.sender, amount);

        require(token.transfer(msg.sender, amount), "token transfer failed");
        return true;
    }

    /// @notice owner is able to redistribute tokens to reward participants
    /// @param _contributor ethereum account that will be rewarded tokens
    /// @param _amount amount of tokens to award
    /// @return true if successful, otherwise false
    function rewardContributor(address _contributor, uint256 _amount) 
        public onlyOwner returns (bool)
    {
        require(_contributor != address(0), "contributor cannot be 0x0");
        require(_amount > 0, "amount is zero");

        emit ContributorRewarded(msg.sender, _contributor, _amount);
        distributeRewards(_contributor, _amount);
        return true;
    }

    ///
    /// INTERNAL FUNCTIONS
    ///
    /// @dev track balances of any rewards going out of the token pool
    function distributeRewards(address _owner, uint256 _amount) internal {
        balances[_owner] = balances[_owner].add(_amount);
    }

    /// @dev ensure a device is validated for registration
    /// @dev updates device registry
    function validateAndRegisterDevice(address manufacturer, bytes32 _deviceIdHash, bytes32 _deviceType) internal
    {
        require(_deviceIdHash != 0, "hash of device id is empty");
        require(_deviceType != 0, "device type is empty");

        Device storage d = devices[_deviceIdHash];
        require(!d.registered, "already registered");
        require(!d.activated, "already activated");

        bytes32 manufacturerId = network[manufacturer].memberId;
        require(manufacturerId != 0, "no manufacturer id was found");

        d.manufacturerId = manufacturerId;
        d.deviceType = _deviceType;
        d.registered = true;
        d.activated = false;
        d.reputationScore = "";
        d.registeredBy = manufacturer;
    }

    /// @dev ensure a device is validated for activation
    /// @dev updates device registry
    function validateAndActivateDevice(bytes32 _deviceId) internal {
        bytes32 deviceIdHash = keccak256(_deviceId);
        Device storage d = devices[deviceIdHash];
        require(d.registered, "not registered");
        require(!d.activated, "already activated");
        require(d.manufacturerId != 0, "no manufacturer id was found");

        d.activated = true;
    }

    /// @dev ensure a device is validated for a new reputation score
    /// @dev updates device registry
    function validateAndUpdateReputation(bytes32 _deviceId, bytes32 _reputationScore)
        internal
    {
        require(_deviceId != 0, "device id is empty");

        Device storage d = devices[keccak256(_deviceId)];
        require(d.registered, "not registered");
        require(d.activated, "not activated");
        require(d.reputationScore != _reputationScore, "new score needs to be different");

        d.reputationScore = _reputationScore;
    }
}
