pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/token/ERC827/ERC827Token.sol";


contract AtonomiToken is ERC827Token {
    string public constant name = "Atonomi Token";
    string public constant symbol = "ATMI";
    uint8 public constant decimals = 18;

    function AtonomiToken() public ERC827Token() {
        uint256 tokenSale = 500000000;
        uint256 foundersAndTeam = 150000000;
        uint256 userGrowthPool = 170000000;
        uint256 tokenReserve = 180000000;
        totalSupply_ = (tokenSale + foundersAndTeam + userGrowthPool + tokenReserve) * (10 ** uint256(decimals));
        emit Transfer(address(0), msg.sender, totalSupply_);
        balances[msg.sender] = totalSupply_;
    }
}
