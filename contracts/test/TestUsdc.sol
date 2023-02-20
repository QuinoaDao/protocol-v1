// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestUsdc is ERC20, ERC20Burnable, Ownable {
    
    constructor() ERC20("TestUsdc", "USDC") {
        _mint(_msgSender(), 10000000000000*1e6);
    }

    function decimals() public pure override returns(uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}