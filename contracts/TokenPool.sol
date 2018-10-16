pragma solidity ^0.4.24;

import "zos-lib/contracts/migrations/Migratable.sol";
import "./EternalStorage.sol";


contract TokenPool is Migratable {
    /// @notice emitted everytime a manufacturer changes their wallet for rewards
    /// @param _old ethereum account
    /// @param _new ethereum account
    /// @param _manufacturerId that the member belongs to
    event ManufacturerRewardWalletChanged(
        address indexed _old,
        address indexed _new,
        bytes32 indexed _manufacturerId
    );

    /// @notice emitted everytime a token pool reward amount changes
    /// @param _sender ethereum account of the token pool owner
    /// @param _newReward new reward value in ATMI tokens
    event TokenPoolRewardUpdated(
        address indexed _sender,
        uint256 _newReward
    );

    /// @title Atonomi Storage
    EternalStorage public atonomiStorage;

    ///
    /// MODIFIERS
    ///
    /// @notice only manufacturers can call, otherwise throw
    modifier onlyManufacturer() {
        require(atonomiStorage.getBool(
            keccak256("network", msg.sender, "isManufacturer")), "must be a manufacturer");
        _;
    }

    /// @notice Initialize the Reputation Manager Contract
    /// @param _storage is the Eternal Storage contract address
    function initialize(address _storage) public isInitializer("TokenPool", "0.0.1") {
        require(_storage != address(0), "storage address cannot be 0x0");

        atonomiStorage = EternalStorage(_storage);
    }

    //
    // TOKEN POOL MANAGEMENT
    //
    /// @notice changes the ethereum wallet for a manufacturer used in reputation rewards
    /// @param _new new ethereum account
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be original manufacturer account
    function changeManufacturerWallet(address _new) public onlyManufacturer returns (bool) {
        require(_new != address(0), "new address cannot be 0x0");

        require(atonomiStorage.getBool(keccak256("network", msg.sender, "isManufacturer")), "must be a manufacturer");
        require(atonomiStorage.getBytes32(keccak256("network", msg.sender, "memberId")) != 0, "must be a manufacturer");

        // copy permissions

        bool oldIdIrnAdmin = atonomiStorage.getBool(keccak256("network", msg.sender, "isIRNAdmin"));
        bool oldIsManufacturer = atonomiStorage.getBool(keccak256("network", msg.sender, "isManufacturer"));
        bool oldIsIRNNode = atonomiStorage.getBool(keccak256("network", msg.sender, "isIRNNode"));
        bytes32 oldMemberId = atonomiStorage.getBytes32(keccak256("network", msg.sender, "memberId"));

        require(!oldIdIrnAdmin, "already an irn admin");
        require(!oldIsManufacturer, "already a manufacturer");
        require(!oldIsIRNNode, "already an irn node");
        require(oldMemberId == 0, "already assigned a member id");


        atonomiStorage.setBool(keccak256("network", _new, "isIRNAdmin"), oldIdIrnAdmin);
        atonomiStorage.setBool(keccak256("network", _new, "isManufacturer"), oldIsManufacturer);
        atonomiStorage.setBool(keccak256("network", _new, "isIRNNode"), oldIsIRNNode);
        atonomiStorage.setBytes32(keccak256("network", _new, "memberId"), oldMemberId);

        
        // transfer balance from old pool to the new pool
        require(atonomiStorage.getUint(keccak256("pools", _new, "balance")) == 0, "new token pool already exists");
        require(atonomiStorage.getUint(keccak256("pools", _new, "rewardAmount")) == 0, "new token pool already exists");

        atonomiStorage.setUint(keccak256("pools", _new, "balance"),
            atonomiStorage.getUint(keccak256("pools", msg.sender, "balance")));
        atonomiStorage.setUint(keccak256("pools", _new, "rewardAmount"),
            atonomiStorage.getUint(keccak256("pools", msg.sender, "rewardAmount")));

        atonomiStorage.deleteUint(keccak256("pools", msg.sender, "balance"));
        atonomiStorage.deleteUint(keccak256("pools", msg.sender, "rewardAmount"));

        // update reward mapping
        atonomiStorage.setAddress(keccak256("manufacturerRewards", msg.sender, "address"), _new);

        // delete old member
        atonomiStorage.deleteBool(keccak256("network", msg.sender, "isIRNAdmin"));
        atonomiStorage.deleteBool(keccak256("network", msg.sender, "isManufacturer"));
        atonomiStorage.deleteBool(keccak256("network", msg.sender, "isIRNNode"));
        atonomiStorage.deleteBytes32(keccak256("network", msg.sender, "memberId"));

        emit ManufacturerRewardWalletChanged(msg.sender, _new, oldMemberId);
        return true;
    }

    /// @notice allows a token pool owner to set a new reward amount
    /// @param newReward new reputation reward amount
    /// @return true if successful, otherwise false
    /// @dev msg.sender expected to be manufacturer
    function setTokenPoolReward(uint256 newReward) public onlyManufacturer returns (bool) {
        require(newReward != 0, "newReward is required");

        require(atonomiStorage.getUint(keccak256("pools", msg.sender, "rewardAmount")) != newReward,
            "newReward should be different");

        atonomiStorage.setUint(keccak256("pools", msg.sender, "rewardAmount"), newReward);
        emit TokenPoolRewardUpdated(msg.sender, newReward);
        return true;
    }
}
