// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

interface ISwapModule {
    function swapExactInput(
        uint256 amountIn,
        address inputToken,
        address outputToken
    ) external;

    function swapExactOutput(
        uint256 amountOut,
        address inputToken,
        address outputToken
    ) external;

    function estimateSwapInputAmount(
        uint256 amountOut,
        address inputToken,
        address outputToken
    ) external returns (uint256);

    function extimateSwapOutputAmount(
        uint256 amountIn,
        address inputToken,
        address outputToken
    ) external returns (uint256);
}
