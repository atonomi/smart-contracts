pragma solidity ^0.4.24;

import "zos-lib/contracts/Initializable.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./EternalStorage.sol";


/// @title Atonomi Network Settings
/// @notice This contract controls all owner configurable variables in the network
contract NetworkSettings is Initializable, Ownable {
    
     /// @notice emitted everytime the registration fee changes
    /// @param _sender ethereum account of participant that made the change
    /// @param _amount new fee value in ATMI tokens
    event RegistrationFeeUpdated(
        address indexed _sender,
        uint256 _amount
    );

    /// @notice emitted everytime the activation fee changes
    /// @param _sender ethereum account of participant that made the change
    /// @param _amount new fee value in ATMI tokens
    event ActivationFeeUpdated(
        address indexed _sender,
        uint256 _amount
    );

    /// @notice emitted everytime the default reputation reward changes
    /// @param _sender ethereum account of participant that made the change
    /// @param _amount new fee value in ATMI tokens
    event DefaultReputationRewardUpdated(
        address indexed _sender,
        uint256 _amount
    );

    /// @notice emitted everytime owner changes the contributation share for reputation authors
    /// @param _sender ethereum account of participant that made the change
    /// @param _percentage new percentage value
    event ReputationIRNNodeShareUpdated(
        address indexed _sender,
        uint256 _percentage
    );

    /// @notice emitted everytime the block threshold is changed
    /// @param _sender ethereum account who made the change
    /// @param _newBlockThreshold new value for all token pools
    event RewardBlockThresholdChanged(
        address indexed _sender,
        uint256 _newBlockThreshold
    );

    /// @title Atonomi Storage
    EternalStorage private atonomiStorage;

    /// @notice Constructor for Atonomi Reputation contract
    /// @param _owner initial owner of the contract
    /// @param _registrationFee initial registration fee on the network
    /// @param _activationFee initial activation fee on the network
    /// @param _defaultReputationReward initial reputation reward on the network
    /// @param _reputationIRNNodeShare share that the reputation author recieves (remaining goes to manufacturer)
    /// @param _blockThreshold the number of blocks that need to pass to receive the full reward
    function initialize(
        address _owner,
        uint256 _registrationFee,
        uint256 _activationFee,
        uint256 _defaultReputationReward,
        uint256 _reputationIRNNodeShare,
        uint256 _blockThreshold,
        address _storage
    ) public initializer() {
        require(_owner != address(0), "owner cannot be 0x0");
        require(_activationFee > 0, "activation fee must be greater than 0");
        require(_registrationFee > 0, "registration fee must be greater than 0");
        require(_defaultReputationReward > 0, "default reputation reward must be greater than 0");
        require(_reputationIRNNodeShare > 0, "new share must be larger than zero");
        require(_reputationIRNNodeShare < 100, "new share must be less than 100");
        require(_storage != address(0), "storage cannot be 0x0");

        owner = _owner;

        atonomiStorage = EternalStorage(_storage);
        
        // Registration Fee
        // Manufacturer pays token to register a device
        // Manufacturer will recieve a share in any reputation updates for a device
        atonomiStorage.setUint(keccak256("registrationFee"), _registrationFee);
        // Activiation Fee
        // Manufacturer or Device Owner pays token to activate device
        atonomiStorage.setUint(keccak256("activationFee"), _activationFee);
        // Default Reputation Reward
        // The default reputation reward set for new manufacturers
        atonomiStorage.setUint(keccak256("defaultReputationReward"), _defaultReputationReward);
        // Reputation Share for IRN Nodes
        // Percentage that the irn node or auditor receives (remaining goes to manufacturer)
        atonomiStorage.setUint(keccak256("reputationIRNNodeShare"), _reputationIRNNodeShare);
        // Block threshold
        // The number of blocks that need to pass between reputation updates to gain the full reward
        atonomiStorage.setUint(keccak256("blockThreshold"), _blockThreshold);
    }

    /// @notice sets the global registration fee
    /// @param _registrationFee new fee for registrations in ATMI tokens
    /// @return true if successful, otherwise false
    function setRegistrationFee(uint256 _registrationFee) public onlyOwner returns (bool) {
        require(_registrationFee > 0, "new registration fee must be greater than zero");
        require(_registrationFee != this.registrationFee(), "new registration fee must be different");
        
        atonomiStorage.setUint(keccak256("registrationFee"), _registrationFee);

        emit RegistrationFeeUpdated(msg.sender, _registrationFee);
        return true;
    }

    /// @notice sets the global activation fee
    /// @param _activationFee new fee for activations in ATMI tokens
    /// @return true if successful, otherwise false
    function setActivationFee(uint256 _activationFee) public onlyOwner returns (bool) {
        require(_activationFee > 0, "new activation fee must be greater than zero");
        require(_activationFee != atonomiStorage.getUint(keccak256("activationFee")), 
                "new activation fee must be different");

        atonomiStorage.setUint(keccak256("activationFee"), _activationFee);

        emit ActivationFeeUpdated(msg.sender, _activationFee);
        return true;
    }

    /// @notice sets the default reputation reward for new manufacturers
    /// @param _defaultReputationReward new reward for reputation score changes in ATMI tokens
    /// @return true if successful, otherwise false
    function setDefaultReputationReward(uint256 _defaultReputationReward) public onlyOwner returns (bool) {
        require(_defaultReputationReward > 0, "new reputation reward must be greater than zero");
        require(_defaultReputationReward != atonomiStorage.getUint(keccak256("defaultReputationReward")),
            "new reputation reward must be different");

        atonomiStorage.setUint(keccak256("defaultReputationReward"), _defaultReputationReward);

        emit DefaultReputationRewardUpdated(msg.sender, _defaultReputationReward);
        return true;
    }

    /// @notice sets the global reputation reward share allotted to the authors and manufacturers
    /// @param _reputationIRNNodeShare new percentage of the reputation reward allotted to author
    /// @return true if successful, otherwise false
    function setReputationIRNNodeShare(uint256 _reputationIRNNodeShare) public onlyOwner returns (bool) {
        require(_reputationIRNNodeShare > 0, "new share must be larger than zero");
        require(_reputationIRNNodeShare < 100, "new share must be less than to 100");
        require(atonomiStorage.getUint(keccak256("reputationIRNNodeShare")) != _reputationIRNNodeShare,
            "new share must be different");

        atonomiStorage.setUint(keccak256("reputationIRNNodeShare"), _reputationIRNNodeShare);

        emit ReputationIRNNodeShareUpdated(msg.sender, _reputationIRNNodeShare);
        return true;
    }

    /// @notice sets the global block threshold for rewards
    /// @param _newBlockThreshold new value for all token pools
    /// @return true if successful, otherwise false
    function setRewardBlockThreshold(uint _newBlockThreshold) public onlyOwner returns (bool) {
        require(_newBlockThreshold != atonomiStorage.getUint(keccak256("blockThreshold")), "must be different");

        atonomiStorage.setUint(keccak256("blockThreshold"), _newBlockThreshold);

        emit RewardBlockThresholdChanged(msg.sender, _newBlockThreshold);
        return true;
    }

    function activationFee() public view returns (uint256) {
        return atonomiStorage.getUint(keccak256("activationFee"));
    }

    function registrationFee() public view returns (uint256) {
        return atonomiStorage.getUint(keccak256("registrationFee"));
    }
    
    function defaultReputationReward() public view returns (uint256) {
        return atonomiStorage.getUint(keccak256("defaultReputationReward"));
    }

    function reputationIRNNodeShare() public view returns (uint256) {
        return atonomiStorage.getUint(keccak256("reputationIRNNodeShare"));
    }

    function blockThreshold() public view returns (uint256) {
        return atonomiStorage.getUint(keccak256("blockThreshold"));
    }
}
