pragma solidity ^0.4.11;

import '../StentorCrowdsale.sol';

// @dev DevTokensHolderMock mocks current block number

contract StentorCrowdsaleMock is StentorCrowdsale {

    uint mock_time;

    function StentorCrowdsaleMock(uint256 _startTime, uint256 _endTime, uint256 _rate, uint256 _goal, uint256 _cap, uint256 _individualCap, address _vault, address _token)
    StentorCrowdsale( _startTime, _endTime, _rate, _goal, _cap, _individualCap, _vault, _token) {
        mock_time = now;
    }

    function getTime() internal returns (uint256) {
        return mock_time;
    }

    function setMockedTime(uint _t) {
        mock_time = _t;
    }
}