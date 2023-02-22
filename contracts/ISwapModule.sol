// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

interface ISwapModule {
    function getRouterAddress() external view returns(address);
    function getFactoryAddress() external view returns(address);

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
