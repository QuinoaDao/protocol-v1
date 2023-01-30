// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;
 
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IProduct is IERC20, IERC20Metadata {

    ///@dev Product에서 사용하는 underlying asset 1개의 정보를 담아놓는 구조체.
    struct AssetParams {
        address assetAddress;
        address oracleAddress;
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

    function currentAssets() external view returns(AssetParams[] memory); 
    function checkAsset(address assetAddress) external returns (bool isExist); 
    function addAsset(address newAssetAddress, address newOracleAddress) external;
    function updateWeight(address[] memory assetAddresses, uint256[] memory assetWeights) external; 
    function updateOracleAddress(address[] memory assetAddresses, address[] memory assetOracles) external;
    function updateDeviationThreshold(uint256 newDeviationThreshold) external;
    function updateFloatRatio(uint256 newFloatRatio) external;

    ///@notice Functions using the balance keyword return asset's balances(amount)
    function assetBalance(address assetAddress) external view returns(uint256); 
    function assetFloatBalance(address assetAddress) external view returns(uint256); 

    ///@notice Functions that include the value keyword return values reflecting the market price of that asset
    function portfolioValue() external view returns(uint256);
    function assetValue(address assetAddress) external view returns (uint256); 
    function totalFloatValue() external view returns (uint256);
    function assetFloatValue(address assetAddress) external view returns(uint256);
    
    function maxDeposit(address receiver) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);

    function withdraw(address assetAddress, uint256 assetAmount, address receiver, address owner) external returns (uint256 shares); 
    function deposit(address assetAddress, uint256 assetAmount, address receiver) external returns (uint256 shares); 
    function rebalance() external;

    function convertToShares(uint256 assetAmount) external view returns(uint256 shareAmount);
    function convertToAssets(uint256 shareAmount) external view returns (uint256 assetAmount);
}