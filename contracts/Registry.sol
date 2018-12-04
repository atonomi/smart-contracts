pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/*
 * @title BasicRegistry
 * @dev A simple implementation of a registry, allows any address to add/remove items
 */
contract Registry is Ownable {

    mapping(address => bool) items;

    event ItemAdded(address _address);

    event ItemRemoved(address _address);

    /**
     * @dev Adds an item to the registry.
     * @param _address The item to add to the registry, must be unique.
     */
    function add(address _address) public onlyOwner {
        require(!_exists(_address));
        items[_address] = true;
        emit ItemAdded(_address);
    }

    /**
     * @dev Removes an item from the registry, reverts if the item does not exist.
     * @param _address The item to remove from the registry.
     */
    function remove(address _address) public onlyOwner {
        require(_exists(_address));
        _remove(_address);
    }

    /**
     * @dev Checks if an item exists in the registry.
     * @param _address The item to check.
     * @return A bool indicating whether the item exists.
     */
    function exists(address _address) public view returns (bool) {
        return _exists(_address);
    }

    /**
     * @dev Internal function to check if an item exists in the registry.
     * @param _address The item to check.
     * @return A bool indicating whether the item exists.
     */
    function _exists(address _address) internal view returns (bool) {
        return items[_address];
    }

    /**
     * @dev Internal function to remove an item from the registry.
     * @param _address The item to remove from the registry.
     */
    function _remove(address _address) internal {
        items[_address] = false;
        emit ItemRemoved(_address);
    }
}