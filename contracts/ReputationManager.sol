pragma solidity ^0.4.24;

import "zos-lib/contracts/migrations/Migratable.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
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

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}


contract ReputationManager is Migratable, Ownable, Pausable {
    using SafeMath for uint256;

    /// @title ATMI Token
    /// @notice Standard ERC20 Token
    /// @dev AMLToken source: https://github.com/TokenMarketNet/ico/blob/master/contracts/AMLToken.sol
    ERC20Interface public token;

    ///
    /// EVENTS 
    ///
    /// @notice emitted on reputation change for a device
    /// @param _deviceId device id of the target device
    /// @param _deviceType is the type of device categorized by the manufacturer
    /// @param _newScore updated reputation score
    /// @param _irnNode IRN node submitting the new reputation
    /// @param _irnReward tokens awarded to irn node
    /// @param _manufacturerWallet manufacturer associated with the device is rewared a share of tokens
    /// @param _manufacturerReward tokens awarded to contributor
    event ReputationScoreUpdated(
        bytes32 indexed _deviceId,
        bytes32 _deviceType,
        bytes32 _newScore,
        address indexed _irnNode,
        uint256 _irnReward,
        address indexed _manufacturerWallet,
        uint256 _manufacturerReward
    );

    /// @notice emitted everytime the default reputation for a manufacturer changes
    /// @param _sender ethereum account of participant that made the change
    /// @param _manufacturerId of the manufacturer
    /// @param _newDefaultScore to use for newly registered devices
    event DefaultReputationScoreChanged(
        address indexed _sender,
        bytes32 indexed _manufacturerId,
        bytes32 _newDefaultScore
    );

    /// @title Atonomi Storage
    EternalStorage public atonomiStorage;

    ///
    /// MODIFIERS
    ///
    /// @notice only IRN Nodes can call, otherwise throw
    modifier onlyIRNNode() {
        require(atonomiStorage.getBool(keccak256("network", "msg.sender", "isIRNNode")), "must be an irn node");
        _;
    }

    ///
    /// STORAGE GETTERS
    ///
    /// @notice get default reputation for manufucturer
    function defaultManufacturerReputation(bytes32 _memberId) public view returns(bytes32) {
        return atonomiStorage.getBytes32(
            keccak256(
                "defaultManufacturerReputation",
                _memberId)
        );
    }

    /// @notice Initialize the Reputation Manager Contract
    /// @param _owner is the owner of the contract
    /// @param _storage is the Eternal Storage contract address
    /// @param _token is the Atonomi Token contract address (must be ERC20)
    function initialize(
        address _owner,
        address _storage,
        address _token)
    public isInitializer("ReputationManager", "0.0.1") {
        require(_owner != address(0), "owner cannot be 0x0");
        require(_storage != address(0), "storage address cannot be 0x0");
        require(_token != address(0), "token address cannot be 0x0");

        owner = _owner;
        atonomiStorage = EternalStorage(_storage);
        token = ERC20Interface(_token);
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
    function updateReputationScore(
        bytes32 _deviceId,
        bytes32 _reputationScore)
        public onlyIRNNode whenNotPaused returns (bool)
    {
        _updateReputationScore(_deviceId, _reputationScore);

        bytes32 manufacturerId = atonomiStorage.getBytes32(keccak256("devices", _deviceId, "manufacturerId"));
        bytes32 deviceType = atonomiStorage.getBytes32(keccak256("devices", _deviceId, "deviceType"));

        address _manufacturerWallet = atonomiStorage.getAddress(keccak256("manufacturerRewards", manufacturerId));
        require(_manufacturerWallet != address(0), "_manufacturerWallet cannot be 0x0");
        require(_manufacturerWallet != msg.sender, "manufacturers cannot collect the full reward");

        uint256 irnReward;
        uint256 manufacturerReward;
        (irnReward, manufacturerReward) = getReputationRewards(msg.sender, _manufacturerWallet, _deviceId);
        _distributeRewards(_manufacturerWallet, msg.sender, irnReward);
        _distributeRewards(_manufacturerWallet, _manufacturerWallet, manufacturerReward);
        emit ReputationScoreUpdated(
            _deviceId,
            deviceType,
            _reputationScore,
            msg.sender,
            irnReward,
            _manufacturerWallet,
            manufacturerReward);
        atonomiStorage.setUint(keccak256("authorWrites", msg.sender, _deviceId), block.number);
        return true;
    }

    /// @notice computes the portion of the reputation reward allotted to the manufacturer and author
    /// @param author is the reputation node submitting the score
    /// @param manufacturer is the token pool owner
    /// @param deviceId of the device being updated
    /// @return irnReward and manufacturerReward
    function getReputationRewards(
        address author,
        address manufacturer,
        bytes32 deviceId)
        public view returns (uint256 irnReward, uint256 manufacturerReward)
    {
        uint256 lastWrite = atonomiStorage.getUint(keccak256("authorWrites", author, deviceId));
        uint256 blocks = 0;
        if (lastWrite > 0) {
            blocks = block.number.sub(lastWrite);
        }
        uint256 totalRewards = calculateReward(
            atonomiStorage.getUint(keccak256("pools", manufacturer, "rewardAmount")), blocks);
        irnReward = totalRewards.mul(atonomiStorage.getUint(keccak256("reputationIRNNodeShare"))).div(100);
        manufacturerReward = totalRewards.sub(irnReward);
    }

    /// @notice computes total reward based on the authors last submission
    /// @param rewardAmount total amount available for reward
    /// @param blocksSinceLastWrite number of blocks since last write
    /// @return actual reward available
    function calculateReward(uint256 rewardAmount, uint256 blocksSinceLastWrite) public view returns (uint256) {
        uint256 totalReward = rewardAmount;
        uint256 blockThreshold = atonomiStorage.getUint(keccak256("blockThreshold"));
        if (blocksSinceLastWrite > 0 && blocksSinceLastWrite < blockThreshold) {
            uint256 multiplier = 10 ** uint256(token.decimals());
            totalReward = rewardAmount.mul(blocksSinceLastWrite.mul(multiplier)).div(blockThreshold.mul(multiplier));
        }
        return totalReward;
    }

    /// @notice allows the owner to change the default reputation for manufacturers
    /// @param _manufacturerId of the manufacturer
    /// @param _newDefaultScore to use for newly registered devices
    /// @return true if successful, otherwise false
    /// @dev owner is the only one with this feature
    function setDefaultReputationForManufacturer(
        bytes32 _manufacturerId,
        bytes32 _newDefaultScore) public onlyOwner returns (bool) {
        require(_manufacturerId != 0, "_manufacturerId is required");
        require(_newDefaultScore != defaultManufacturerReputation(_manufacturerId),
            "_newDefaultScore should be different");

        atonomiStorage.setBytes32(keccak256(
            "defaultManufacturerReputation",
            _manufacturerId),
            _newDefaultScore
        );

        emit DefaultReputationScoreChanged(msg.sender, _manufacturerId, _newDefaultScore);
        return true;
    }

    ///
    /// INTERNAL FUNCTIONS
    ///
    /// @dev track balances of any rewards going out of the token pool
    function _distributeRewards(address _manufacturer, address _owner, uint256 _amount) internal {
        require(_amount > 0, "_amount is required");

        uint256 balance = atonomiStorage.getUint(keccak256("pools", _manufacturer, "balance"));
        atonomiStorage.setUint(keccak256("pools", _manufacturer, "balance"), balance.sub(_amount));

        uint256 reward = atonomiStorage.getUint(keccak256("rewards", _owner));
        atonomiStorage.setUint(keccak256("rewards", _owner), reward.add(_amount));
    }

    /// @dev ensure a device is validated for a new reputation score
    /// @dev updates device registry
    function _updateReputationScore(bytes32 _deviceId, bytes32 _reputationScore) internal {
        require(_deviceId != 0, "device id is empty");

        require(atonomiStorage.getBool(
            keccak256("devices", _deviceId, "registered")), "not registered");
        require(atonomiStorage.getBool(
            keccak256("devices", _deviceId, "activated")), "not activated");
        require(atonomiStorage.getBytes32(
            keccak256("devices", _deviceId, "reputationScore")) != _reputationScore, "new score needs to be different");

        atonomiStorage.setBytes32(keccak256("devices", _deviceId, "reputationScore"), _reputationScore);
    }
}


