pragma solidity ^0.4.23;


contract MockContractReceiver {
    event TestLog(uint n);

    function onTokenTransfer(uint n) public returns (bool) {
        emit TestLog(n);
        return true;
    }

    function onTokenApprove(uint n) public returns (bool) {
        emit TestLog(n);
        return true;
    }
}