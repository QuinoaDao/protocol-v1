// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./ISwapModule.sol";

contract SwapModule is ISwapModule{
    address public factory;
    IUniswapV2Router02 public immutable router;

    constructor(address factory_, address router_) public {
        factory = factory_;
        router = IUniswapV2Router02(router_);
    }

    function getPair(address tokenA, address tokenB) internal view returns (IUniswapV2Pair) {
        IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(factory, tokenA, tokenB));
        return pair;
    }

    function getRouterAddress() external override returns (address) {
        return address(router);
    }

    function swapExactInput(uint256 amountIn, address inputToken, address outputToken, address quinoaVault) external override {
        IUniswapV2Pair pair = getPair(inputToken, outputToken);
        (uint reserves0, uint reserves1,) = pair.getReserves();
        (uint inputTokenReserve, uint outputTokenReserve) = inputToken == pair.token0() ? (reserves0, reserves1) : (reserves1, reserves0);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;

        uint amountOut = UniswapV2Library.getAmountOut(amountIn, inputTokenReserve, outputTokenReserve);

        // set slippate to 0.5%
        uint tokenAmountOutMin = amountOut * (1000 - 5) / 1000;
        uint256[] memory swapedAmounts = router.swapExactTokensForTokens(amountIn, tokenAmountOutMin, path, quinoaVault, block.timestamp);
    }

    function estimateSwapOutputAmount( uint256 amountIn, address inputToken, address outputToken) external override returns (uint256) {
        IUniswapV2Pair pair = getPair(inputToken, outputToken);
        (uint reserves0, uint reserves1,) = pair.getReserves();
        (uint inputTokenReserve, uint outputTokenReserve) = inputToken == pair.token0() ? (reserves0, reserves1) : (reserves1, reserves0);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;

        uint amountOut = UniswapV2Library.getAmountOut(amountIn, inputTokenReserve, outputTokenReserve);
        return amountOut;
    }

    function swapExactOutput(uint256 amountOut, address inputToken, address outputToken, address quinoaVault) external override {
        IUniswapV2Pair pair = getPair(inputToken, outputToken);
        (uint reserves0, uint reserves1,) = pair.getReserves();
        (uint inputTokenReserve, uint outputTokenReserve) = inputToken == pair.token0() ? (reserves0, reserves1) : (reserves1, reserves0);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;

        uint amountIn = UniswapV2Library.getAmountIn(amountOut, inputTokenReserve, outputTokenReserve);

        // set slippate to 0.5%
        uint tokenAmountInMax = amountOut * (1000 + 5) / 1000;
        uint256[] memory swapedAmounts = router.swapTokensForExactTokens(tokenAmountInMax, amountOut, path, quinoaVault, block.timestamp);
    }

    function estimateSwapInputAmount( uint256 amountOut, address inputToken, address outputToken) external override returns (uint256) {
        IUniswapV2Pair pair = getPair(inputToken, outputToken);
        (uint reserves0, uint reserves1,) = pair.getReserves();
        (uint inputTokenReserve, uint outputTokenReserve) = inputToken == pair.token0() ? (reserves0, reserves1) : (reserves1, reserves0);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;

        uint amountIn = UniswapV2Library.getAmountIn(amountOut, inputTokenReserve, outputTokenReserve);
        return amountIn;
    }
}
