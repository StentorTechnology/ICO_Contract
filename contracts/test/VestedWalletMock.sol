pragma solidity ^0.4.15;

import '../VestedWallet.sol';

// @dev DevTokensHolderMock mocks current block time

contract VestedWalletMock is VestedWallet {

    uint mock_time;

    function VestedWalletMock(address _owner, address _contribution, address _sgt)
    VestedWallet(_owner, _contribution, _sgt) {
        mock_time = now;
    }

    function getTime() internal returns (uint256) {
        return mock_time;
    }

    function setMockedTime(uint _t) {
        mock_time = _t;
    }
}