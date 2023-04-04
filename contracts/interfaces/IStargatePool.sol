// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.6.0 <0.9.0;

interface IStargatePool {
    function amountLPtoLD(uint256 _amountLP) external view returns (uint256); // Lp token의 개수를 받아 해당하는 LD token(usdc) token 개수로 변환
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns(uint256);
    function totalLiquidity() external view returns(uint256);
    function poolId() external view returns(uint256);
}