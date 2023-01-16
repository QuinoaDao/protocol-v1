// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IVault is IERC20, IERC20Metadata {

    struct AssetParams {
        address assetAddress;
        uint256 targetWeight;
    }

    struct StrategyParams {
        address strategyAddress;
        address assetAddress;
        uint256 assetBalance;
    }

    // MUST be emitted when tokens are deposited into the vault via the mint and deposit methods
    event Deposit(
        address indexed sender,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    // MUST be emitted when shares are withdrawn from the vault by a depositor in the redeem or withdraw methods.
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 share
    );

    function totalAssets() external view returns (uint256); // vault에서 다루고 있는 전체 asset의 dollar 기준의 양 반환
    function totalSupply() external view returns (uint256); // // erc20 function
    function balanceOf(address owner) external view returns (uint256); // erc20 function

    function totalFloat() external view returns (uint256); // 현재 float의 전체 dollar 가치 반환
    function balanceOfAsset() external view returns(uint256); // 현재 asset 1개에 해당하는 float의 토큰 "양" 반환 -> withdraw, rebalance 등에 필요

    function addAsset(address newAssetAddress) external; // 새로운 token 추가 -> 처음엔 % 0으로 설정
    function updateWeight(AssetParams[] memory newParams) external; // token들 weight를 최신으로 update
    function currentWeight() external returns(AssetParams[] memory); // 현재 token들 weight 상태를 반환
    function checkAsset(address assetAddress) external returns (bool isExist); // 현재 token list 중 assetAddress가 존재하는지 확인

    function withdraw(address assetAddress, uint256 assetAmount, address receiver, address owner) external returns (uint256 shares); // asset 1개에 대해서 asset withdraw
    function deposit(address assetAddress, uint256 assetAmount, address receiver) external returns (uint256 shares); // asset 1개에 대해서 asset deposit
    function rebalance() external; // weight 에 맞춰서 rebalance 진행

    // strategy와 상호작용
    function depositIntoStrategy(address strategyAddress, uint256 assetAmount) external; // strategy에 transfer 바로 하기
    function redeemFromStrategy(address strategyAddress, uint256 assetAmount) external; // 왜 withdraw가 아니라 redeem임 ? 

    // 특히 white list 시기에는 max값 지정 필요
    function maxDeposit(address receiver) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);

    // 
    function convertToShares(uint256 assets) external view returns(uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function previewWithdraw(uint256 assets) external view returns (uint256);
    function previewDeposit(uint256 assets) external view returns (uint256);

    // function maxMint(address receiver) external view returns (uint256);
    // function previewMint(uint256 shares) external view returns (uint256);
    // function maxRedeem(address owner) external view returns (uint256);
    // function previewRedeem(uint256 shares) external view returns (uint256);
    // function mint(uint256 shares, address receiver) external returns (uint256 assets);
    // function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

}