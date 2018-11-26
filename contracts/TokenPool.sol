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

    event Transfer(address indexed from, address indexed to, uint tokens);   // solhint-disable-line
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}


contract TokenPool is Migratable, Pausable {
    using SafeMath for uint256;

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

    /// @title Atonomi Storage
    EternalStorage public atonomiStorage;

    /// @title ATMI Token
    /// @notice Standard ERC20 Token
    /// @dev AMLToken source: https://github.com/TokenMarketNet/ico/blob/master/contracts/AMLToken.sol
    ERC20Interface public token;

    ///
    /// MODIFIERS
    ///
    /// @notice only manufacturers can call, otherwise throw
    modifier onlyManufacturer() {
        require(atonomiStorage.getBool(
            keccak256("network", msg.sender, "isManufacturer")), "must be a manufacturer");
        _;
    }

    ///
    /// STORAGE GETTERS
    ///
    /// @notice get current balance of token pool for account
    function poolBalance(address _owner) public view returns (uint256) {
        return atonomiStorage.getUint(
            keccak256(
                "pools",
                _owner,
                "balance")
        );
    }

    /// @notice Initialize the Reputation Manager Contract
    /// @param _storage is the Eternal Storage contract address
    /// @param _token is the Atonomi Token contract address (must be ERC20)
    function initialize(address _storage, address _token) public isInitializer("TokenPool", "0.0.1") {
        require(_storage != address(0), "storage address cannot be 0x0");
        require(_token != address(0), "token address cannot be 0x0");

        atonomiStorage = EternalStorage(_storage);
        token = ERC20Interface(_token);
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

        bool newIdIrnAdmin = atonomiStorage.getBool(keccak256("network", _new, "isIRNAdmin"));
        bool newIsManufacturer = atonomiStorage.getBool(keccak256("network", _new, "isManufacturer"));
        bool newIsIRNNode = atonomiStorage.getBool(keccak256("network", _new, "isIRNNode"));
        bytes32 newMemberId = atonomiStorage.getBytes32(keccak256("network", _new, "memberId"));

        require(!newIdIrnAdmin, "already an irn admin");
        require(!newIsManufacturer, "already a manufacturer");
        require(!newIsIRNNode, "already an irn node");
        require(newMemberId == 0, "already assigned a member id");


        atonomiStorage.setBool(keccak256("network", _new, "isIRNAdmin"), newIdIrnAdmin);
        atonomiStorage.setBool(keccak256("network", _new, "isManufacturer"), newIsManufacturer);
        atonomiStorage.setBool(keccak256("network", _new, "isIRNNode"), newIsIRNNode);
        atonomiStorage.setBytes32(keccak256("network", _new, "memberId"), newMemberId);

        
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

        emit ManufacturerRewardWalletChanged(msg.sender, _new, newMemberId);
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

        require(token.transfer(msg.sender, amount), "token transfer failed");*/
        return true;
    }
}
