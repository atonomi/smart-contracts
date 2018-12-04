pragma solidity ^0.4.24;
import "./Registry.sol";


contract EternalStorage {

    /// @title Atonomi Storage
    Registry public registry;
    
    /// @notice Initialize the Atonomi Smart Contract
    /// @param _registry is the Atonomi Contract Registry
    constructor (address _registry) public {
        require(_registry != address(0), "registry cannot be 0x0");
        registry = Registry(_registry);
    }

    mapping(bytes32 => uint256) private uIntStorage;
    mapping(bytes32 => string) private stringStorage;
    mapping(bytes32 => address) private addressStorage;
    mapping(bytes32 => bytes) private bytesStorage;
    mapping(bytes32 => bytes32) private bytes32Storage;
    mapping(bytes32 => bool) private boolStorage;
    mapping(bytes32 => int256) private intStorage;

    modifier onlyRegistered(){
        require(registry.exists(msg.sender), "Must be a registered Atonomi contract");
        _;
    }

    function setAddress(bytes32 _key, address _value) external onlyRegistered {
        addressStorage[_key] = _value;
    }

    function setUint(bytes32 _key, uint256 _value) external onlyRegistered {
        uIntStorage[_key] = _value;
    }

    function setString(bytes32 _key, string _value) external onlyRegistered {
        stringStorage[_key] = _value;
    }

    function setBytes(bytes32 _key, bytes _value) external onlyRegistered {
        bytesStorage[_key] = _value;
    }

    function setBytes32(bytes32 _key, bytes32 _value) external onlyRegistered {
        bytes32Storage[_key] = _value;
    }

    function setBool(bytes32 _key, bool _value) external onlyRegistered {
        boolStorage[_key] = _value;
    }

    function setInt(bytes32 _key, int _value) external onlyRegistered {
        intStorage[_key] = _value;
    }

    function deleteAddress(bytes32 _key) external onlyRegistered {
        delete addressStorage[_key];
    }

    function deleteUint(bytes32 _key) external onlyRegistered {
        delete uIntStorage[_key];
    }

    function deleteString(bytes32 _key) external onlyRegistered {
        delete stringStorage[_key];
    }

    function deleteBytes(bytes32 _key) external onlyRegistered {
        delete bytesStorage[_key];
    }

    function deleteBytes32(bytes32 _key) external onlyRegistered {
        delete bytes32Storage[_key];
    }

    function deleteBool(bytes32 _key) external onlyRegistered {
        delete boolStorage[_key];
    }

    function deleteInt(bytes32 _key) external onlyRegistered {
        delete intStorage[_key];
    }

    function getAddress(bytes32 _key) external view returns (address) {
        return addressStorage[_key];
    }

    function getUint(bytes32 _key) external view returns (uint256) {
        return uIntStorage[_key];
    }

    function getString(bytes32 _key) external view returns (string) {
        return stringStorage[_key];
    }

    function getBytes(bytes32 _key) external view returns (bytes) {
        return bytesStorage[_key];
    }

    function getBytes32(bytes32 _key) external view returns (bytes32) {
        return bytes32Storage[_key];
    }

    function getBool(bytes32 _key) external view returns (bool) {
        return boolStorage[_key];
    }

    function getInt(bytes32 _key) external view returns (int256) {
        return intStorage[_key];
    }
}