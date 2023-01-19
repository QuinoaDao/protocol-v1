// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IProduct.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Product is ERC20, IProduct {
    using Math for uint256;

    // struct AssetParams {
    //     address assetAddress;
    //     uint256 targetWeight;
    // }

    // struct StrategyParams {
    //     address strategyAddress;
    //     address assetAddress;
    //     uint256 assetBalance;
    // }

    // // MUST be emitted when tokens are deposited into the vault via the mint and deposit methods
    // event Deposit(
    //     address indexed sender,
    //     address indexed owner,
    //     uint256 assets,
    //     uint256 shares
    // );

    // // MUST be emitted when shares are withdrawn from the vault by a depositor in the redeem or withdraw methods.
    // event Withdraw(
    //     address indexed sender,
    //     address indexed receiver,
    //     address indexed owner,
    //     uint256 assets,
    //     uint256 share
    // );

    AssetParams[] public assets; // asset list 
    StrategyParams[] public strategies; // strategy list

    // erc20 state varibales
    // mapping(address => uint256) private _balances;

    // mapping(address => mapping(address => uint256)) private _allowances;

    // uint256 private _totalSupply;

    // string private _name;
    // string private _symbol;

    string private _dacName; // DB가 없어서 contract에서도 필요한 듯
    address private _dacAddress; // 애초에 필요
    uint256 private _sinceDate;

    modifier onlyDac{
        require(_msgSender()==_dacAddress);
        _;
    }

    constructor(
        string memory name_, 
        string memory symbol_, 
        string memory dacName_, 
        address dacAddress_, 
        AssetParams[] memory assets_
        ) 
        ERC20(name_, symbol_)
    {
        _dacName = dacName_;
        _dacAddress = dacAddress_;
        _sinceDate = block.timestamp;
    }

    // 사용할 asset들마다 decimal 체크 필요
    function decimals() public view virtual override(ERC20, IERC20Metadata) returns (uint8) {
        return 18;
    } 

    function dacName() public view returns(string memory) {
        return _dacName;
    }

    function dacAddress() public view returns(address) {
        return _dacAddress;
    }

    function sinceDate() public view returns(uint256) {
        return _sinceDate;
    }

    function totalAssets() external view override returns (uint256) {

    }
    // function totalSupply() external view override returns (uint256){ // erc20 function

    // } 
    // function balanceOf(address owner) external view override returns (uint256){ // erc20 function

    // }

    function totalFloat() external view override returns (uint256){

    }
    function balanceOfAsset(address assetAddress) external view override returns(uint256){

    }

    function addAsset(address newAssetAddress) external override {

    }
    function updateWeight(AssetParams[] memory newParams) external override{

    }
    function currentWeight() external override returns(AssetParams[] memory){

    }
    function checkAsset(address assetAddress) external override returns (bool isExist){

    }

    function maxDeposit(address receiver) external view override returns (uint256){ // for deposit

    }
    function maxWithdraw(address owner) external view override returns (uint256){ // for withdraw
    }

    function withdraw(address assetAddress, uint256 assetAmount, address receiver, address owner) external override returns (uint256 shares){

    }
    function deposit(address assetAddress, uint256 assetAmount, address receiver) external override returns (uint256 shares){

    }
    function rebalance() external override{

    }

    // strategy와 상호작용
    function depositIntoStrategy(address strategyAddress, uint256 assetAmount) external override{

    }
    function redeemFromStrategy(address strategyAddress, uint256 assetAmount) external override{
        
    }
}