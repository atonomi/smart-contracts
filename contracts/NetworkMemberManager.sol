pragma solidity ^0.4.24;

import "zos-lib/contracts/migrations/Migratable.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./EternalStorage.sol";


contract NetworkMemberManager is Migratable, Ownable {
    /// @notice emitted on successful addition of network member address
    /// @param _sender ethereum account of participant that made the change
    /// @param _member address of added member
    /// @param _memberId manufacturer id for manufacturer, otherwise 0x0
    event NetworkMemberAdded(
        address indexed _sender,
        address indexed _member,
        bytes32 indexed _memberId
    );

    /// @notice emitted on successful removal of network member address
    /// @param _sender ethereum account of participant that made the change
    /// @param _member address of removed member
    /// @param _memberId manufacturer id for manufacturer, otherwise 0x0
    event NetworkMemberRemoved(
        address indexed _sender,
        address indexed _member,
        bytes32 indexed _memberId
    );

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

    ///MODIFIERS///
    /// @notice only IRNAdmins or Owner can call, otherwise throw
    modifier onlyIRN() {
        require(atonomiStorage.getBool(
            keccak256("network", "msg.sender", "isIRNAdmin")), "must be owner or an irn admin");
        _;
    }

    /// @notice only manufacturers can call, otherwise throw
    modifier onlyManufacturer() {
        require(atonomiStorage.getBool(
            keccak256("network", "msg.sender", "isManufacturer")), "must be a manufacturer");
        _;
    }

    /// @notice Initialize the Network Member Manager Contract
    /// @param _owner is the owner of the contract
    /// @param _storage is the Eternal Storage contract address
    function initialize (
        address _owner,
        address _storage)
    public isInitializer("NetworkMemberManager", "0.0.1") {
        require(_owner != address(0), "owner cannot be 0x0");
        require(_storage != address(0), "storage address cannot be 0x0");

        owner = _owner;
        atonomiStorage = EternalStorage(_storage);
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
    function addNetworkMember(
        address _member,
        bool _isIRNAdmin,
        bool _isManufacturer,
        bool _isIRNNode,
        bytes32 _memberId)
        public onlyIRN returns(bool)
    {
        require(!atonomiStorage.getBool(keccak256("network", _member, "isIRNAdmin")), "already an irn admin");
        require(!atonomiStorage.getBool(keccak256("network", _member, "isManufacturer")), "already a manufacturer");
        require(!atonomiStorage.getBool(keccak256("network", _member, "isIRNNode")), "already an irn node");
        require(atonomiStorage.getUint(keccak256("network", _member, "memberId")) != 0, "already assigned a member id");

        atonomiStorage.setBool(keccak256("network", _member, "isIRNAdmin"), _isIRNAdmin);
        atonomiStorage.setBool(keccak256("network", _member, "isManufacturer"), _isManufacturer);
        atonomiStorage.setBool(keccak256("network", _member, "isIRNNode"), _isIRNNode);
        atonomiStorage.setBytes32(keccak256("network", _member, "memberId"), _memberId);

        if (_isManufacturer) {
            require(_memberId != 0, "manufacturer id is required");

            // keep lookup for rewards in sync
            require(atonomiStorage.getAddress(
                keccak256("manufacturerRewards", _memberId)) == address(0), "manufacturer is already assigned");
            atonomiStorage.setAddress(
                keccak256("manufacturerRewards", _memberId), _member);

            // set reputation reward if token pool doesnt exist
            if (atonomiStorage.getAddress(
                keccak256("pools", _member, "rewardAmount")) == 0) {
                //TODO This check may need revision
                atonomiStorage.setUint(
                    keccak256("pools", _member, "rewardAmount"),
                    atonomiStorage.getUint(keccak256("defaultReputationReward")));
            }
        }

        emit NetworkMemberAdded(msg.sender, _member, _memberId);

        return true;
    }

    /// @notice remove a member from the network
    /// @param _member ethereum address of member to be removed
    /// @return true if successful, otherwise false
    /// @dev msg.sender is expected to be either owner or irn admin
    function removeNetworkMember(address _member) public onlyIRN returns(bool) {
        bytes32 memberId = atonomiStorage.getBytes32(keccak256("network", _member, "memberId"));
        bool isManufacturer = atonomiStorage.getBool(keccak256("network", _member, "isManufacturer"));
        if (isManufacturer) {
            // remove token pool if there is a zero balance
            if (atonomiStorage.getAddress(keccak256("pools", _member, "balance")) == 0) {
                atonomiStorage.deleteUint(keccak256("pools", _member, "balance"));
                atonomiStorage.deleteUint(keccak256("pools", _member, "rewardAmount"));
            }

            // keep lookup with rewards in sync
            atonomiStorage.deleteUint(keccak256("manufacturerRewards", memberId));
        }

        atonomiStorage.deleteBool(keccak256("network", _member, "isIRNAdmin"));
        atonomiStorage.deleteBool(keccak256("network", _member, "isManufacturer"));
        atonomiStorage.deleteBool(keccak256("network", _member, "isIRNNode"));
        atonomiStorage.deleteBytes32(keccak256("network", _member, "memberId"));

        emit NetworkMemberRemoved(msg.sender, _member, memberId);
        return true;
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
