pragma solidity ^0.4.21;


contract MockSolHash {
    function solHash(bytes32 clearText) public pure returns (bytes32) {
        return keccak256(clearText);
    }
}