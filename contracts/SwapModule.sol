// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

contract SwapModule {
    address public swapFactory;
    IUniswapV2Router02 public swapRouter;

    function _swapExactInput(uint256 amountIn, address inputToken, address outputToken, address to) internal {
        IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(swapFactory, inputToken, outputToken));
        (uint reserves0, uint reserves1,) = pair.getReserves();
        (uint inputTokenReserve, uint outputTokenReserve) = inputToken == pair.token0() ? (reserves0, reserves1) : (reserves1, reserves0);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;

        uint amountOut = UniswapV2Library.getAmountOut(amountIn, inputTokenReserve, outputTokenReserve);

        // set slippate to 0.5%
        uint tokenAmountOutMin = amountOut * (1000 - 5) / 1000;
        swapRouter.swapExactTokensForTokens(amountIn, tokenAmountOutMin, path, to, block.timestamp);
    }

    function _estimateSwapOutputAmount( uint256 amountIn, address inputToken, address outputToken) internal view returns (uint256) { 
        if(amountIn == 0){
            return 0;
        }

        IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(swapFactory, inputToken, outputToken));
        (uint reserves0, uint reserves1,) = pair.getReserves();

        (uint inputTokenReserve, uint outputTokenReserve) = inputToken == pair.token0() ? (reserves0, reserves1) : (reserves1, reserves0);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;

        uint amountOut = UniswapV2Library.getAmountOut(amountIn, inputTokenReserve, outputTokenReserve);
        return amountOut;
    }

    function _swapExactOutput(uint256 amountOut, address inputToken, address outputToken, address to) internal {
        IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(swapFactory, inputToken, outputToken));
        (uint reserves0, uint reserves1,) = pair.getReserves();
        (uint inputTokenReserve, uint outputTokenReserve) = inputToken == pair.token0() ? (reserves0, reserves1) : (reserves1, reserves0);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;

        uint amountIn = UniswapV2Library.getAmountIn(amountOut, inputTokenReserve, outputTokenReserve);

        // set slippate to 0.5%
        uint tokenAmountInMax = amountIn * (1000 + 5) / 1000;
        swapRouter.swapTokensForExactTokens(amountOut, tokenAmountInMax, path, to, block.timestamp);
    }

    function _estimateSwapInputAmount( uint256 amountOut, address inputToken, address outputToken) internal view returns (uint256) {

        if(amountOut == 0){
            return 0;
        }

        IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(swapFactory, inputToken, outputToken));
        (uint reserves0, uint reserves1,) = pair.getReserves();
        (uint inputTokenReserve, uint outputTokenReserve) = inputToken == pair.token0() ? (reserves0, reserves1) : (reserves1, reserves0);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;

        uint amountIn = UniswapV2Library.getAmountIn(amountOut, inputTokenReserve, outputTokenReserve);
        uint tokenAmountInMax = amountIn * (1000 + 5) / 1000;
        return tokenAmountInMax;
    }
}
