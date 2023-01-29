// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.6;

interface ISwapModule {
    function getRouterAddress() external returns(address);

    function swapExactInput(
        uint256 amountIn,
        address inputToken,
        address outputToken,
        address quinoaVault
    ) external;

    function swapExactOutput(
        uint256 amountOut,
        address inputToken,
        address outputToken,
        address quinoaVault
    ) external;

    function estimateSwapInputAmount(
        uint256 amountOut,
        address inputToken,
        address outputToken
    ) external returns (uint256);

    function estimateSwapOutputAmount(
        uint256 amountIn,
        address inputToken,
        address outputToken
    ) external returns (uint256);
}
