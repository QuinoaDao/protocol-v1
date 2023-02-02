// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;
 
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IProduct is IERC20, IERC20Metadata {

    ///@dev Product에서 사용하는 underlying asset 1개의 정보를 담아놓는 구조체.
    struct AssetParams {
        address assetAddress;
        uint256 targetWeight;
        uint256 currentPrice;
    }

    ///@dev MUST be emitted when tokens are deposited into the vault via the deposit methods
    event Deposit(
        address indexed sender,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    ///@dev MUST be emitted when shares are withdrawn from the vault by a depositor in the withdraw methods.
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 share
    );

    ///@dev Must be emitted when rebalancing occure via the rebalance methods
    event Rebalance(
        address indexed caller, 
        AssetParams[] currentAssets,
        uint256 time
    );

    function currentStrategies() external view returns(address[] memory);
    function currentAssets() external view returns(AssetParams[] memory);
    function dacName() external view returns(string memory);
    function dacAddress() external view returns(address);
    function sinceDate() external view returns(uint256);
    function currentFloatRatio() external view returns(uint256);
    function assetBalance(address assetAddress) external view returns(uint256);
    function portfolioValue() external view returns(uint256);
    function assetValue(address assetAddress) external view returns (uint256);
    function checkActivation() external view returns(bool);


    function deposit(
        address assetAddress, 
        uint256 assetAmount, 
        address receiver
    ) external  returns (uint256);

    function withdraw(
        address assetAddress, 
        uint256 shareAmount,
        address receiver, 
        address owner
    ) external returns (uint256);

    function rebalance() external;

    function maxDepositValue(address receiver) external returns(uint256);
    function maxWithdrawValue(address owner) external returns (uint256);

    function convertToShares(address assetAddress, uint256 assetAmount) external returns(uint256 shareAmount);
    function convertToAssets(address assetAddress, uint256 shareAmount) external returns(uint256 assetAmount);

    function sharePrice() external returns(uint256);
    function shareValue(uint256 shareAmount) external returns(uint256);

}