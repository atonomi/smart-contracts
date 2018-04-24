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
/// @author Atonomi, LLC
/// @notice Governs the activation, registration, and reputation of devices on the Atonomi network
/// @dev Ownable source: https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/ownership/Ownable.sol
/// @dev Owner governs the access of Atonomi Fees and Admins on the network
contract Atonomi is Ownable {
    using SafeMath for uint256;

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
    /// @notice Reputation Auditor/Validator receives token for contributing reputation score
    /// @notice IRN Node of the manufacturer pays token to reward contributors
    uint256 public reputationReward;

    /// @title Reputation Contributor Share
    /// @notice Percentage of the reputation reward allotted to the party contributing the score
    uint256 public reputationContributorShare;

    /// @title ATMI Token
    /// @notice Standard ERC20 Token
    /// @dev AMLToken source: https://github.com/TokenMarketNet/ico/blob/master/contracts/AMLToken.sol
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
    /// @dev IRN Nodes: Governs reputation score data of devices
    /// @dev Manufacturers: Governs devices on the network
    /// @dev Key is ethereum account of the participant
    /// @dev Value is a struct that contains the role of the participant
    mapping (address => NetworkMember) public network;

    /// @title Token Pool
    /// @dev Key is ethereum account
    /// @dev Value is tokens available for withdraw
    mapping (address => uint256) public balances;

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
        reputationContributorShare = 80;
    }

    ///
    /// EVENTS 
    ///
    /// @notice emitted on successful device registration
    /// @param _sender manufacturer paying for registration
    /// @param _deviceHashKey hash of device id used as the key in devices mapping
    event DeviceRegistered(address indexed _sender, uint256 fee, bytes32 indexed _deviceHashKey);

    /// @notice emitted on successful device activation
    /// @param _sender manufacturer or device owner paying for activation
    /// @param _deviceId the real device id (only revealed after activation)
    event DeviceActivated(address indexed _sender, uint256 fee, bytes32 indexed _deviceId);

    /// @notice emitted on successful addition of network member address
    /// @param _sender IRN node sending the addition
    /// @param _member address of added member
    /// @param _memberId id of added member (e.g. manufacturer id), "" if not applicable
    event NetworkMemberAdded(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /// @notice emitted on successful removal of network member address
    /// @param _sender IRN node sending the addition
    /// @param _member address of removed member
    /// @param _memberId id of removed member (e.g. manufacturer id), "" if not applicable
    event NetworkMemberRemoved(address indexed _sender, address indexed _member, bytes32 indexed _memberId);

    /// @notice emitted on reputation change for a device
    /// @param _sender IRN node submitting the new reputation
    /// @param _deviceId id of the target device
    /// @param _newScore updated reputation score
    /// @param _contributor Auditor or Validator who contributed to score
    /// @param _contributorReward tokens awarded to contributor
    /// @param _irnReward tokens awarded to irn node
    event ReputationScoreUpdated(address indexed _sender, bytes32 indexed _deviceId,
        bytes32 _newScore, address indexed _contributor, uint256 _contributorReward, uint256 _irnReward);

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

    /// @notice emitted everytime a participant withdraws from token pool
    /// @param _sender ethereum address of participant
    /// @param _amount tokens withdrawn
    event TokensWithdrawn(address indexed _sender, uint256 _amount);

    /// @notice emitted everytime a participant changes the percentage of the reputation
    /// reward allotted to the contributor
    /// @param _sender ethereum address of participant
    /// @param _percentage new percentage value
    event ReputationContributorShareUpdated(address indexed _sender, uint256 _percentage);

    ///
    /// FEE SETTERS
    ///
    /// @notice sets the global activation fee
    /// @param _activationFee new fee for activations in ATMI tokens
    /// @return true if successful, otherwise false
    function setActivationFee(uint256 _activationFee) public onlyOwner returns (bool) {
        require(_activationFee > 0);
        require(_activationFee != activationFee);
        activationFee = _activationFee;
        emit ActivationFeeUpdated(msg.sender, _activationFee);
        return true;
    }

    /// @notice sets the global registration fee
    /// @param _registrationFee new fee for registrations in ATMI tokens
    /// @return true if successful, otherwise false
    function setRegistrationFee(uint256 _registrationFee) public onlyOwner returns (bool) {
        require(_registrationFee > 0);
        require(_registrationFee != registrationFee);
        registrationFee = _registrationFee;
        emit RegistrationFeeUpdated(msg.sender, _registrationFee);
        return true;
    }

    /// @notice sets the global reputation reward
    /// @param _reputationReward new reward for reputation score changes in ATMI tokens
    /// @return true if successful, otherwise false
    function setReputationReward(uint256 _reputationReward) public onlyOwner returns (bool) {
        require(_reputationReward > 0);
        require(_reputationReward != reputationReward);
        reputationReward = _reputationReward;
        emit ReputationRewardUpdated(msg.sender, _reputationReward);
        return true;
    }

    /// @notice sets the global reputation reward share allotted to the contributor
    /// @param _reputationContributorShare new percentage of the reputation reward allotted to contributor
    /// @return true if successful, otherwise false
    function setReputationContributorShare(uint256 _reputationContributorShare) public onlyOwner returns (bool) {
        require(_reputationContributorShare > 0);
        require(_reputationContributorShare <= 100);
        require(reputationContributorShare != _reputationContributorShare);
        reputationContributorShare = _reputationContributorShare;
        emit ReputationContributorShareUpdated(msg.sender, _reputationContributorShare);
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
        require(validateAndRegisterDevice(msg.sender, _deviceIdHash, _hardwarePublicKey));
        balances[address(this)] = balances[address(this)].add(registrationFee);
        emit DeviceRegistered(msg.sender, registrationFee, _deviceIdHash);
        require(token.transferFrom(msg.sender, address(this), registrationFee));
        return true;
    }

    /// @notice Activates the device
    /// @param _deviceId id of the real device id to be activated (not the has of the device id)
    /// @return true if successful, otherwise false
    /// @dev if the hash doesnt match, the device is considered not registered and will throw
    /// @dev anyone with the device id (in hand) is considered the device owner
    /// @dev tokens will be deducted from the device owner to the IRN Node the device belongs to
    function activateDevice(bytes32 _deviceId) public returns (bool) {
        require(validateAndActivateDevice(_deviceId));
        balances[address(this)] = balances[address(this)].add(activationFee);
        emit DeviceActivated(msg.sender, activationFee, _deviceId);
        require(token.transferFrom(msg.sender, address(this), activationFee));
        return true;
    }

    /// @notice Registers and immediately activates device, used by manufacturers to prepay activation
    /// @param _deviceId id of the real device id to be activated (not the has of the device id)
    /// @param _hardwarePublicKey public key of the physical device used for validation
    /// @return true if successful, otherwise false
    /// @dev since the manufacturer is trusted, no need for the caller to hash the device id
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer to the IRN Node the device belongs to
    function registerAndActivateDevice(bytes32 _deviceId, bytes32 _hardwarePublicKey) 
        public onlyManufacturer returns (bool)
    {
        bytes32 deviceIdHash = keccak256(_deviceId);
        require(validateAndRegisterDevice(msg.sender, deviceIdHash, _hardwarePublicKey));
        emit DeviceRegistered(msg.sender, registrationFee, deviceIdHash);

        require(validateAndActivateDevice(_deviceId));
        emit DeviceActivated(msg.sender, activationFee, _deviceId);

        uint256 fee = registrationFee.add(activationFee);
        balances[address(this)] = balances[address(this)].add(fee);
        require(token.transferFrom(msg.sender, address(this), fee));
        return true;
    }

    ///
    /// REPUTATION MANAGEMENT
    ///
    /// @notice updates reputation for a device
    /// @param _deviceId target device Id
    /// @param _reputationScore updated reputation score computed by the IRN
    /// @param _contributor who is rewarded tokens for contributing
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be an irn node
    /// @dev tokens will be deducted from the IRN Node to the contributor who wrote the score
    function updateReputationScore(bytes32 _deviceId, bytes32 _reputationScore, address _contributor)
        public onlyIRNNode returns (bool)
    {
        require(_contributor != address(0));
        require(validateAndUpdateReputation(_deviceId, _reputationScore));

        uint256 contributorReward;
        uint256 irnReward;
        (contributorReward, irnReward) = getReputationRewards();
        balances[address(this)] = balances[address(this)].sub(contributorReward).sub(irnReward);
        balances[_contributor] = balances[_contributor].add(contributorReward);
        balances[msg.sender] = balances[msg.sender].add(irnReward);

        emit ReputationScoreUpdated(msg.sender, _deviceId, _reputationScore, _contributor,
            contributorReward, irnReward);
        return true;
    }

    /// @notice allows participants in the Atonomi network to claim their rewards
    /// @return true if successful, otherwise false
    function withdrawTokens() public returns (bool) {
        uint amount = balances[msg.sender];
        require(amount > 0);

        balances[msg.sender] = 0;
        emit TokensWithdrawn(msg.sender, amount);

        require(token.transfer(msg.sender, amount));
        return true;
    }

    ///@notice computes the portion of the reputation reward allotted to the contributor
    ///@return computed value in ATMI
    function getReputationRewards() public view returns (uint256, uint256) {
        uint256 contributorReward = reputationReward.mul(reputationContributorShare).div(100);
        uint256 irnReward = reputationReward.sub(contributorReward);
        return (contributorReward, irnReward);
    }

    ///
    /// BULK OPERATIONS
    ///
    /// @notice registers multiple devices on the Atonomi network
    /// @param _deviceIdHashes array of secret hashed ID's of each device
    /// @param _hardwarePublicKeys array of public keys of each physical device
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer to the IRN Node they belong to
    function registerDevices(bytes32[] _deviceIdHashes, bytes32[] _hardwarePublicKeys)
        public onlyManufacturer returns (bool)
    {
        require(_deviceIdHashes.length > 0);
        require(_hardwarePublicKeys.length > 0);
        require(_deviceIdHashes.length == _hardwarePublicKeys.length);

        uint256 runningBalance = 0;
        for (uint256 i = 0; i < _deviceIdHashes.length; i++) {
            bytes32 deviceIdHash = _deviceIdHashes[i];
            bytes32 hardwarePublicKey = _hardwarePublicKeys[i];
            if (deviceIdHash == 0 || hardwarePublicKey == 0) {
                revert();
            }

            Device memory d = devices[deviceIdHash];
            if (d.registered || d.activated) {
                revert();
            }

            require(validateAndRegisterDevice(msg.sender, deviceIdHash, hardwarePublicKey));
            emit DeviceRegistered(msg.sender, registrationFee, deviceIdHash);

            runningBalance = runningBalance.add(registrationFee);
        }

        balances[address(this)] = balances[address(this)].add(runningBalance);
        require(token.transferFrom(msg.sender, address(this), runningBalance));
        return true;
    }

    /// @notice registers and activates multiple devices on the Atonomi network
    /// @param _deviceIds array of real device ids
    /// @param _hardwarePublicKeys array of public keys of each physical device
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer to the IRN Node they belong to
    function registerAndActivateDevices(bytes32[] _deviceIds, bytes32[] _hardwarePublicKeys)
        public onlyManufacturer returns (bool)
    {
        require(_deviceIds.length > 0);
        require(_hardwarePublicKeys.length > 0);
        require(_deviceIds.length == _hardwarePublicKeys.length);

        uint256 runningBalance = 0;
        uint256 fee = registrationFee.add(activationFee);
        for (uint256 i = 0; i < _deviceIds.length; i++) {
            bytes32 deviceId = _deviceIds[i];
            if (deviceId == 0) {
                revert();
            }

            bytes32 deviceIdHash = keccak256(deviceId);
            bytes32 hardwarePublicKey = _hardwarePublicKeys[i];
            if (deviceIdHash == 0 || hardwarePublicKey == 0) {
                revert();
            }

            Device memory d = devices[deviceIdHash];
            if (d.registered || d.activated) {
                revert();
            }

            require(validateAndRegisterDevice(msg.sender, keccak256(deviceId), hardwarePublicKey));
            emit DeviceRegistered(msg.sender, registrationFee, deviceIdHash);

            require(validateAndActivateDevice(deviceId));
            emit DeviceActivated(msg.sender, activationFee, deviceId);

            runningBalance = runningBalance.add(fee);
        }

        balances[address(this)] = balances[address(this)].add(runningBalance);
        require(token.transferFrom(msg.sender, address(this), runningBalance));
        return true;
    }

    /// @notice updates reputation for multiple device
    /// @param _deviceIds array of target device Ids
    /// @param _reputationScores array of updated reputation scores computed by the IRN
    /// @param _contributor who is rewarded tokens for contributing
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be an irn node
    /// @dev tokens will be deducted from the IRN Node to the contributor who wrote the score
    function updateReputationScores(bytes32[] _deviceIds, bytes32[] _reputationScores, address _contributor)
        public onlyIRNNode returns (bool)
    {
        require(_deviceIds.length > 0);
        require(_reputationScores.length > 0);
        require(_deviceIds.length == _reputationScores.length);
        require(_contributor != address(0));

        for (uint256 i = 0; i < _deviceIds.length; i++) {
            bytes32 _deviceId = _deviceIds[i];
            if (_deviceId == 0) {
                revert();
            }

            bytes32 _reputationScore = _reputationScores[i];
            Device memory d = devices[keccak256(_deviceId)];
            if (!d.registered || !d.activated || d.reputationScore == _reputationScore) {
                revert();
            }

            require(validateAndUpdateReputation(_deviceId, _reputationScore));

            uint256 contributorReward;
            uint256 irnReward;
            (contributorReward, irnReward) = getReputationRewards();
            balances[address(this)] = balances[address(this)].sub(contributorReward).sub(irnReward);
            balances[_contributor] = balances[_contributor].add(contributorReward);
            balances[msg.sender] = balances[msg.sender].add(irnReward);

            emit ReputationScoreUpdated(msg.sender, _deviceId, _reputationScore, _contributor,
                contributorReward, irnReward);
        }

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

    function validateAndRegisterDevice(address manufacturer, bytes32 _deviceIdHash, bytes32 _hardwarePublicKey)
        internal returns (bool)
    {
        require(_deviceIdHash != 0);
        require(_hardwarePublicKey != 0);

        Device storage d = devices[_deviceIdHash];
        require(!d.registered);
        require(!d.activated);

        bytes32 manufacturerId = network[manufacturer].memberId;
        require(manufacturerId != 0);

        d.hardwarePublicKey = _hardwarePublicKey;
        d.manufacturerId = manufacturerId;
        d.registered = true;
        d.activated = false;
        d.reputationScore = "";
        return true;
    }

    function validateAndActivateDevice(bytes32 _deviceId) internal returns(bool) {
        bytes32 deviceIdHash = keccak256(_deviceId);
        Device storage d = devices[deviceIdHash];
        require(d.registered);
        require(!d.activated);
        require(d.manufacturerId != 0);

        d.activated = true;
        return true;
    }

    function validateAndUpdateReputation(bytes32 _deviceId, bytes32 _reputationScore)
        internal returns (bool)
    {
        require(_deviceId != 0);

        Device storage d = devices[keccak256(_deviceId)];
        require(d.registered);
        require(d.activated);
        require(d.reputationScore != _reputationScore);

        d.reputationScore = _reputationScore;
        return true;
    }
}
