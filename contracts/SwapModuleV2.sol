// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;
pragma abicoder v2;

//SwapModuleV2 is a contract that implements uniswapV3 price oracle and functions to execute swap
import '@openzeppelin/contracts/utils/Address.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol'; 
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

contract SwapModuleV2 {

  IUniswapV3Factory public immutable override UNISWAP_V3_FACTORY;
  ISwapRouter public immutable override UNISWAP_V3_ROUTER;

  uint24[] internal _knownFeeTiers;

  constructor(address _UNISWAP_V3_FACTORY, address _UNISWAP_V3_ROUTER) {
    UNISWAP_V3_FACTORY = IUniswapV3Factory(_UNISWAP_V3_FACTORY);
    UNISWAP_V3_ROUTER = ISwapRouter(_UNISWAP_V3_ROUTER);

    // Assign default fee tiers
    _knownFeeTiers.push(500); // 0.05% (stable) ex)stable-stable
    _knownFeeTiers.push(3000); // 0.30% (standard) ex)nonstable-stable
    _knownFeeTiers.push(10000); //1.00% (exotic) ex)nonstable-nonstable
  }

  function supportedFeeTiers() external view override returns (uint24[] memory) {
    return _knownFeeTiers;
  }

  function isPairSupported(address _tokenA, address _tokenB) external view override returns (bool) {
    uint256 _length = _knownFeeTiers.length;
    for (uint256 i; i < _length; ++i) {
      address _pool = PoolAddress.computeAddress(address(UNISWAP_V3_FACTORY), PoolAddress.getPoolKey(_tokenA, _tokenB, _knownFeeTiers[i]));
      if (Address.isContract(_pool)) {
        return true;
      }
    }
    return false;
  }
 
  function getAllPoolsForPair(address _tokenA, address _tokenB) public view override returns (address[] memory) {
    return _getPoolsForTiers(_tokenA, _tokenB, _knownFeeTiers);
  }

  function sqrtPriceX96ToUint(uint160 sqrtPriceX96, uint8 decimalsToken0)
    internal
    pure
    returns (uint256)
  {
    uint256 numerator1 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
    uint256 numerator2 = 10**decimalsToken0;
    return FullMath.mulDiv(numerator1, numerator2, 1 << 192);
  }


  /// @notice Takes a pair and fee tier, and returns pool that match conditions
  /// @param _tokenA One of the pair's tokens
  /// @param _tokenB The other of the pair's tokens
  /// @param _feeTier The fee tier to consider when searching for the pair's pools
  /// @return pool A pool address for the given pair and fee tier
  function getPoolForTier(
    address _tokenA,
    address _tokenB,
    uint24 _feeTier
  ) public view returns (address) {
    address pool = UNISWAP_V3_FACTORY.getPool(_tokenA, _tokenB, _feeTier);
    require(pool != address(0), "pool doesn't exist");

    return pool;
  }

  function getCurrentSpotPrice(
    address _tokenA, 
    address _tokenB, 
    uint24 _feeTier
  ) public view returns (address token0, address token1, uint256 token0PriceInValueOfToken1, uint256 token1PriceInValueOfToken0){
    address pool = getPoolForTier(_tokenA, _tokenB, _feeTier);
    (token0, token1) = _tokenA < _tokenB ? (_tokenA, _tokenB) : (_tokenB, _tokenA);

    (uint160 sqrtPriceX96,,,,,,) =  IUniswapV3Pool(pool).slot0();
    token0PriceInValueOfToken1 = sqrtPriceX96ToUint(sqrtPriceX96, IERC20(decimalsToken0).decimals());
    token1PriceInValueOfToken0 = sqrtPriceX96ToUint(1/sqrtPriceX96, IERC20(decimalsToken1).decimals());
  }

  function getTwapQuote(
    address baseToken,
    address quoteToken,
    uint128 baseAmount,
    uint24 feeTier,
    uint32 secondsAgo
  ) public view returns (uint quoteAmount){
    address pool = getPoolForTier(baseToken, quoteToken, feeTier);
    (int24 tick, ) = OracleLibrary.consult(pool, secondsAgo);
    quoteAmount = OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
  }

//   function estimateAmountOut(
//     address tokenIn,
//     address tokenOut,
//     uint256 amountIn,
//     uint24 feeTier,
//     uint32 secondsAgo
//   ) public view returns (uint amountOut){
//     uint128 feeSubtractedAmoutnIn = uint128(amountIn.Mul(uint256(10000) - uint256(feeTier)).Div(uint256(10000))); 
//     uint256 amountOut = getTwapQuote(tokenIn, tokenOut, feeSubtractedAmoutnIn, feeTier, secondsAgo);
//   }

//   function estimateAmountIn(
//     address tokenOut,
//     address tokenIn,
//     uint256 amountOut,
//     uint24 feeTier,
//     uint32 secondsAgo
//   ) public view returns (uint amountOut){
//     uint128 feeSubtractedAmoutnIn = uint128(amountIn.Mul(uint256(10000) - uint256(feeTier)).Div(uint256(10000))); 
//     uint256 amountOut = getTwapQuote(tokenIn, tokenOut, feeSubtractedAmoutnIn, feeTier, secondsAgo);
//   }


  function swapExactInputSingle(
    address _tokenIn,
    address _tokenOut,
    uint24 feeTier,
    uint256 _amountIn
  ) external returns (uint256 amountOut){
    TransferHelper.safeApprove(_tokenIn, address(UNISWAP_V3_ROUTER), _amoutnIn);

    uint32 secondsAgo = 1800;
    uint256 price = getTwapQuote(_tokenIn, _tokenOut, uint128(_amountIn), feeTier, secondsago);
    // set slippate to 0.5%
    uint256 amountOutMin = price * (1000 - 5) / 1000;
    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
        .ExactInputSingleParams({
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            fee: feeTier,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: _amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });

    amountOut = UNISWAP_V3_ROUTER.exactInputSingle(params);
  }

  function swapExactOutputSingle(
    address _tokenOut,
    address _tokenIn,
    uint24 feeTier,
    uint256 _amountOut
  ) external returns (uint256 amountIn){
    uint32 secondsAgo = 1800;
    uint256 price = getTwapQuote(_tokenOut, _tokenIn, uint128(_amountOut), feeTier, secondsago);
    // set slippate to 0.5%
    uint256 amountInMax = price * (1000 + 5) / 1000;
    
    TransferHelper.safeApprove(_tokenIn, address(UNISWAP_V3_ROUTER), amoutnInMax);
    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
        .ExactOutputSingleParams({
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            fee: feeTier,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountOut: _amountOut,
            amountInMaximum: amountInMax,
            sqrtPriceLimitX96: 0
        });

    amountIn = UNISWAP_V3_ROUTER.exactOutputSingle(params);

    if (amountIn < amountInMaximum) {
        TransferHelper.safeApprove(_tokenIn, address(UNISWAP_V3_ROUTER), 0);
        TransferHelper.safeTransfer(_tokenIn, msg.sender, amountInMaximum - amountIn);
    }
  }
}