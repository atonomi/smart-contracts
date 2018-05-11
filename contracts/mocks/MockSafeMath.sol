pragma solidity ^0.4.23;


import "../Atonomi.sol";

contract SafeMathMock {
    using SafeMath for uint256;

    function mul(uint256 a, uint256 b) public pure returns (uint256) {
        return a.mul(b);
    }

    function div(uint256 a, uint256 b) public pure returns (uint256) {
        return a.div(b);
    }

    function sub(uint256 a, uint256 b) public pure returns (uint256) {
        return a.sub(b);
    }

    function add(uint256 a, uint256 b) public pure returns (uint256) {
        return a.add(b);
    }
}