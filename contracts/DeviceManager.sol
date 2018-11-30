pragma solidity ^0.4.24;

import "zos-lib/contracts/migrations/Migratable.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zeppelin-solidity/contracts/lifecycle/TokenDestructible.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./EternalStorage.sol";


/// @title ERC-20 Token Standard
/// @author Fabian Vogelsteller <fabian@ethereum.org>, Vitalik Buterin <vitalik.buterin@ethereum.org>
/// @dev https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md
interface ERC20Interface {
    function decimals() public constant returns (uint8);
    function totalSupply() public constant returns (uint);
    function balanceOf(address tokenOwner) public constant returns (uint balance);
    function allowance(address tokenOwner, address spender) public constant returns (uint remaining);
    function transfer(address to, uint tokens) public returns (bool success);
    function approve(address spender, uint tokens) public returns (bool success);
    function transferFrom(address from, address to, uint tokens) public returns (bool success);

    event Transfer(address indexed from, address indexed to, uint tokens);   // solhint-disable-line
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}


/// @dev Interface for the Network Settings contract
interface SettingsInterface {
    function registrationFee() external view returns (uint256);
    function activationFee() external view returns (uint256);
    function defaultReputationReward() external view returns (uint256);
    function reputationIRNNodeShare() external view returns (uint256);
    function blockThreshold() external view returns (uint256);
}


/// @title Atonomi Smart Contract
/// @author Atonomi
/// @notice Governs the activation, registration, and reputation of devices on the Atonomi network
/// @dev Ownable: Owner governs the access of Atonomi Admins, Fees, and Rewards on the network
/// @dev Pausable: Gives ability for Owner to pull emergency stop to prevent actions on the network
/// @dev TokenDestructible: Gives owner ability to kill the contract and extract funds to a new contract
contract DeviceManager is Migratable, Pausable, TokenDestructible {
    using SafeMath for uint256;

    /// @title ATMI Token
    /// @notice Standard ERC20 Token
    /// @dev AMLToken source: https://github.com/TokenMarketNet/ico/blob/master/contracts/AMLToken.sol
    ERC20Interface public token;

    /// @title Network Settings
    /// @notice Atonomi Owner controlled settings are governed in this contract
    SettingsInterface public settings;

    /// @title Atonomi Storage
    EternalStorage public atonomiStorage;

    ///
    /// MODIFIERS
    ///
    /// @notice only manufacturers can call, otherwise throw
    modifier onlyManufacturer() {
        require(isManufacturer(msg.sender), "must be a manufacturer");
        _;
    }

    ///
    /// STORAGE GETTERS
    ///
    /// @notice checks if an account is a manufacturer
    function isManufacturer(address _account) public view returns(bool) {
        return atonomiStorage.getBool(
            keccak256(
                "network",
                _account,
                "isManufacturer")
        );
    }

    function poolBalance(address _owner) public view returns (uint256) {
        return atonomiStorage.getUint(
            keccak256(
                "pools",
                _owner,
                "balance")
        );
    }

    function getDeviceStorageKey(bytes32 _deviceIdHash, string _name) public view returns (bytes32) {
        return keccak256(
            "devices",
            _deviceIdHash,
            _name
        );
    }

    function networkMemberId(address _account) public view returns(bytes32) {
        return atonomiStorage.getBytes32(
            keccak256(
                "network",
                _account,
                "memberId")
        );
    }

    function manufacturerRewards(bytes32 _memberId) public view returns(address) {
        return atonomiStorage.getAddress(
            keccak256(
                "manufacturerRewards",
                _memberId)
        );
    }

    function defaultManufacturerReputation(bytes32 _memberId) public view returns(bytes32) {
        return atonomiStorage.getBytes32(
            keccak256(
                "defaultManufacturerReputation",
                _memberId)
        );
    }

    /// @notice Initialize the Atonomi Smart Contract
    /// @param _owner is the owner of the contract
    /// @param _storage is the Eternal Storage contract address
    /// @param _token is the Atonomi Token contract address (must be ERC20)
    /// @param _settings is the Atonomi Network Settings contract address
    function initialize (
        address _owner,
        address _storage,
        address _token,
        address _settings)
    public isInitializer("DeviceManager", "0.0.1") {
        require(_owner != address(0), "owner cannot be 0x0");
        require(_storage != address(0), "storage address cannot be 0x0");
        require(_token != address(0), "token address cannot be 0x0");
        require(_settings != address(0), "settings address cannot be 0x0");

        owner = _owner;
        atonomiStorage = EternalStorage(_storage);
        token = ERC20Interface(_token);
    }

    ///
    /// EVENTS 
    ///
    /// @notice emitted on successful device registration
    /// @param _sender manufacturer paying for registration
    /// @param _fee registration fee paid by manufacturer
    /// @param _deviceHashKey keccak256 hash of device id used as the key in devices mapping
    /// @param _manufacturerId of the manufacturer the device belongs to
    /// @param _deviceType is the type of device categorized by the manufacturer
    event DeviceRegistered(
        address indexed _sender,
        uint256 _fee,
        bytes32 indexed _deviceHashKey,
        bytes32 indexed _manufacturerId,
        bytes32 _deviceType
    );

    /// @notice emitted on successful device activation
    /// @param _sender manufacturer or device owner paying for activation
    /// @param _fee registration fee paid by manufacturer
    /// @param _deviceId the real device id (only revealed after activation)
    /// @param _manufacturerId of the manufacturer the device belongs to
    /// @param _deviceType is the type of device categorized by the manufacturer
    event DeviceActivated(
        address indexed _sender,
        uint256 _fee,
        bytes32 indexed _deviceId,
        bytes32 indexed _manufacturerId,
        bytes32 _deviceType
    );

    /// @notice emitted everytime someone donates tokens to a manufacturer
    /// @param _sender ethereum account of the donater
    /// @param _manufacturerId of the manufacturer
    /// @param _manufacturer ethereum account
    /// @param _amount of tokens deposited
    event TokensDeposited(
        address indexed _sender,
        bytes32 indexed _manufacturerId,
        address indexed _manufacturer,
        uint256 _amount
    );

    /// @notice emitted everytime a participant withdraws from token pool
    /// @param _sender ethereum account of participant that made the change
    /// @param _amount tokens withdrawn
    event TokensWithdrawn(
        address indexed _sender,
        uint256 _amount
    );

    ///
    /// DEVICE ONBOARDING
    ///
    /// @notice registers device on the Atonomi network
    /// @param _deviceIdHash keccak256 hash of the device's id (needs to be hashed by caller)
    /// @param _deviceType is the type of device categorized by the manufacturer
    /// @dev devicePublicKey is public key used by IRN Nodes for validation
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer and added to the token pool
    /// @dev owner has ability to pause this operation
    function registerDevice(
        bytes32 _deviceIdHash,
        bytes32 _deviceType,
        bytes32 _devicePublicKey)
        public onlyManufacturer whenNotPaused returns (bool)
    {
        uint256 registrationFee = settings.registrationFee();

        bytes32 manufacturerId = _registerDevice(msg.sender, _deviceIdHash, _deviceType, _devicePublicKey);

        emit DeviceRegistered(
            msg.sender,
            registrationFee,
            _deviceIdHash,
            manufacturerId,
            _deviceType
        );
        _depositTokens(msg.sender, registrationFee);
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
        uint256 activationFee = settings.activationFee();
        
        bytes32 manufacturerId;
        bytes32 deviceType;
        (manufacturerId, deviceType) = _activateDevice(_deviceId);

        emit DeviceActivated(
            msg.sender, 
            activationFee, 
            _deviceId, 
            manufacturerId, 
            deviceType);

        address manufacturer = manufacturerRewards(manufacturerId);
        require(manufacturer != address(this), "manufacturer is unknown");
        _depositTokens(manufacturer, activationFee);
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
    function registerAndActivateDevice(
        bytes32 _deviceId,
        bytes32 _deviceType,
        bytes32 _devicePublicKey) 
        public onlyManufacturer whenNotPaused returns (bool)
    {
        uint256 registrationFee = settings.registrationFee();
        uint256 activationFee = settings.activationFee();
        bytes32 deviceIdHash = keccak256(_deviceId);

        bytes32 manufacturerId = _registerDevice(msg.sender, deviceIdHash, _deviceType, _devicePublicKey);
        emit DeviceRegistered(msg.sender, registrationFee, deviceIdHash, manufacturerId, _deviceType);

        _activateDevice(_deviceId);
        emit DeviceActivated(msg.sender, activationFee, _deviceId, manufacturerId, _deviceType);

        uint256 fee = registrationFee.add(activationFee);
        _depositTokens(msg.sender, fee);
        require(token.transferFrom(msg.sender, address(this), fee), "transferFrom failed");
        return true;
    }

    ///
    /// BULK OPERATIONS
    ///
    /// @notice registers multiple devices on the Atonomi network
    /// @param _deviceIdHashes array of keccak256 hashed ID's of each device
    /// @param _deviceTypes array of types of device categorized by the manufacturer
    /// @param _devicePublicKeys array of public keys associated with the devices
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be the manufacturer
    /// @dev tokens will be deducted from the manufacturer and added to the token pool
    /// @dev owner has ability to pause this operation
    function registerDevices(
        bytes32[] _deviceIdHashes,
        bytes32[] _deviceTypes,
        bytes32[] _devicePublicKeys)
        public onlyManufacturer whenNotPaused returns (bool)
    {
        require(_deviceIdHashes.length > 0, "at least one device is required");
        require(
            _deviceIdHashes.length == _deviceTypes.length,
            "device type array needs to be same size as devices"
        );
        require(
            _deviceIdHashes.length == _devicePublicKeys.length,
            "device public key array needs to be same size as devices"
        );

        uint256 runningBalance = 0;
        uint256 registrationFee = settings.registrationFee();
        for (uint256 i = 0; i < _deviceIdHashes.length; i++) {
            bytes32 deviceIdHash = _deviceIdHashes[i];
            bytes32 deviceType = _deviceTypes[i];
            bytes32 devicePublicKey = _devicePublicKeys[i];
            
            bytes32 manufacturerId = _registerDevice(msg.sender, deviceIdHash, deviceType, devicePublicKey);
            emit DeviceRegistered(msg.sender, registrationFee, deviceIdHash, manufacturerId, deviceType);

            runningBalance = runningBalance.add(registrationFee);
        }

        _depositTokens(msg.sender, runningBalance);
        require(token.transferFrom(msg.sender, address(this), runningBalance), "transferFrom failed");
        return true;
    }

    /// @notice anyone can donate tokens to a manufacturer's pool
    /// @param manufacturerId of the manufacturer to receive the tokens
    /// @param amount of tokens to deposit
    function depositTokens(bytes32 manufacturerId, uint256 amount) public returns (bool) {
        require(manufacturerId != 0, "manufacturerId is required");
        require(amount > 0, "amount is required");
        
        address manufacturer = atonomiStorage.getAddress(keccak256("manufacturerRewards", manufacturerId));
        require(manufacturer != address(0), "manufacturer must have a valid address");
        
        uint256 balance = poolBalance(manufacturer);
        atonomiStorage.setUint(keccak256(
            "pools",
            manufacturer,
            "balance"),
            balance.add(amount)
        );
        
        emit TokensDeposited(msg.sender, manufacturerId, manufacturer, amount);
        
        require(token.transferFrom(msg.sender, address(this), amount));
        
        return true;
    }

    /// @notice allows participants in the Atonomi network to claim their rewards
    /// @return true if successful, otherwise false
    /// @dev owner has ability to pause this operation
    function withdrawTokens() public whenNotPaused returns (bool) {
        uint256 amount = atonomiStorage.getUint(keccak256("rewards", msg.sender));
        require(amount > 0, "amount is zero");
        
        atonomiStorage.setUint(keccak256("rewards", msg.sender), 0);
        emit TokensWithdrawn(msg.sender, amount);

        require(token.transfer(msg.sender, amount), "token transfer failed");
        
        return true;
    }

    ///
    /// INTERNAL FUNCTIONS
    ///
    /// @dev track balances of any deposits going into a token pool
    function _depositTokens(address _owner, uint256 _amount) internal {
        uint256 balance = poolBalance(_owner);
        atonomiStorage.setUint(keccak256(
            "pools",
            _owner,
            "balance"),
            balance.add(_amount)
        );
    }

    /// @dev ensure a device is validated for registration
    /// @dev updates device registry
    function _registerDevice(
        address _manufacturer,
        bytes32 _deviceIdHash,
        bytes32 _deviceType,
        bytes32 _devicePublicKey) internal returns (bytes32) {
        require(_manufacturer != address(0), "manufacturer is required");
        require(_deviceIdHash != 0, "device id hash is required");
        require(_deviceType != 0, "device type is required");
        require(_devicePublicKey != 0, "device public key is required");

        bytes32 registeredKey = getDeviceStorageKey(_deviceIdHash, "registered");
        require(!atonomiStorage.getBool(registeredKey), "device is already registered");
        bytes32 activatedKey = getDeviceStorageKey(_deviceIdHash, "activated");
        require(!atonomiStorage.getBool(activatedKey), "device is already activated");

        bytes32 manufacturerId = networkMemberId(_manufacturer);
        require(manufacturerId != 0, "manufacturer id is unknown");

        atonomiStorage.setBytes32(keccak256("devices",
            _deviceIdHash,
            "manufacturerId"),
            manufacturerId
        );
        atonomiStorage.setBytes32(keccak256("devices",
            _deviceIdHash,
            "deviceType"),
            _deviceType
        );
        atonomiStorage.setBool(keccak256("devices",
            _deviceIdHash,
            "registered"),
            true
        );
        atonomiStorage.setBool(keccak256("devices",
            _deviceIdHash,
            "activated"),
            false
        );
        bytes32 newScore = defaultManufacturerReputation(manufacturerId);
        atonomiStorage.setBytes32(keccak256("devices",
            _deviceIdHash,
            "reputationScore"),
            newScore
        );
        atonomiStorage.setBytes32(keccak256("devices",
            _deviceIdHash,
            "devicePublicKey"),
            _devicePublicKey
        );
        return manufacturerId;
    }

    /// @dev ensure a device is validated for activation
    /// @dev updates device registry
    function _activateDevice(bytes32 _deviceId) internal returns (bytes32 manufacturerId, bytes32 deviceType) {
        bytes32 deviceIdHash = keccak256(_deviceId);

        bytes32 registeredKey = getDeviceStorageKey(deviceIdHash, "registered");
        require(atonomiStorage.getBool(registeredKey), "not registered");

        bytes32 activatedKey = getDeviceStorageKey(deviceIdHash, "activated");
        require(!atonomiStorage.getBool(activatedKey), "already activated");

        bytes32 manufacturerIdKey = getDeviceStorageKey(deviceIdHash, "manufacturerId");
        manufacturerId = atonomiStorage.getBytes32(manufacturerIdKey);
        require(manufacturerId != 0, "no manufacturer id was found");

        bytes32 deviceTypeKey = getDeviceStorageKey(deviceIdHash, "deviceType");
        deviceType = atonomiStorage.getBytes32(deviceTypeKey);

        atonomiStorage.setBool(keccak256("devices",
            deviceIdHash,
            "activated"),
            true
        );
    }
}