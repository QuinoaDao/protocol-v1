// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

interface IStargateRouter {
    function addLiquidity(
        uint256 _poolId,
        uint256 _amountLD,
        address _to
    ) external;

    function instantRedeemLocal(
        uint16 _srcPoolId,
        uint256 _amountLP,
        address _to
    ) external returns (uint256);
}