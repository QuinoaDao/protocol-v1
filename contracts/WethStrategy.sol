// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IStrategy.sol";
import "./IProduct.sol";
import "./interfaces/IBalancerVault.sol";
import "./interfaces/IBeefyVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract WethStrategy is IStrategy {
    // strategy state variables
    address public dac;
    address public product;
    address immutable public underlyingAsset;

    // for yield 
    address public delegate; // Beefy vault
    address public yield; // Balancer vault
    address public yieldPool; // Balancer wstETH StablePool

    modifier onlyProduct {
        require(msg.sender == product, "No permission: only product");
        _;
    }

    modifier onlyDac {
        require(msg.sender == dac, "No permission: only dac");
        _;
    }

    constructor(address dac_, address product_) {
        underlyingAsset = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619; // polygon weth (immutable)
        
        require(dac_ != address(0x0), "Invalid dac address");
        dac = dac_;
        require(product_ != address(0x0), "Invalid product address");
        product = product_;

        delegate = 0x1d81c50d5aB5f095894c41B41BA49B9873033399; // Beefy vault
        yield = 0xBA12222222228d8Ba445958a75a0704d566BF2C8; // Balancer vault
        yieldPool = 0x65Fe9314bE50890Fb01457be076fAFD05Ff32B9A; // Balancer wstETH StablePool

    }

    function totalAssets() external view override returns(uint256) {
        return 0;
    }

    function deposit() external override onlyDac returns(bool) {
        return true;
    }

    function withdraw(uint256 assetAmount) external override returns(bool) {
        return true;
    }

    function withdrawAll() external onlyProduct returns(bool) {
        return true;
    }

}