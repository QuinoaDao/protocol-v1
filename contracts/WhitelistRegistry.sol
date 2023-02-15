// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract WhitelistRegistry is Ownable {

    mapping (address => bool) private _productExists;
    mapping (address=> mapping (address=>bool)) private _whitelistRegistry;

    function addProduct(address product) external onlyOwner {
        require(!_productExists[product], "The product already has whitelist");
        _productExists[product] = true;
    }

    function deleteProduct(address product) external onlyOwner {
        require(_productExists[product], "The product has no whitelist");
        _productExists[product] = false;
    }

    function checkProduct(address product) external view returns(bool){
        return _productExists[product];
    }
    
    function addWhitelist(address product, address user) external onlyOwner {
        require(_productExists[product], "The product has no whitelist");
        _whitelistRegistry[product][user] = true;
    }

    function deleteWhitelist(address product, address user) external onlyOwner {
        require(_productExists[product], "The product has no whitelist");
        _whitelistRegistry[product][user] = false;
    }

    function addMultipleWhitelists(address product, address[] memory users) external onlyOwner {
        require(_productExists[product], "The product has no whitelist");

        uint256 usersLength = users.length;
        for(uint256 i=0; i<usersLength; i++) {
            _whitelistRegistry[product][users[i]] = true;
        }
    }

    function deleteMultipleWhitelists(address product, address[] memory users) external onlyOwner {
        require(_productExists[product], "The product has no whitelist");

        uint256 usersLength = users.length;
        for(uint256 i=0; i<usersLength; i++) {
            _whitelistRegistry[product][users[i]] = false;
        }
    }

    function checkWhitelist(address product, address user) external view returns(bool) {
        return _whitelistRegistry[product][user];
    }

}