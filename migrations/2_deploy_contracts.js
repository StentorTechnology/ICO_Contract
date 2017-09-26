let StentorCrowdsale = artifacts.require('./StentorCrowdsale.sol');
let StentorToken = artifacts.require('./StentorToken.sol');
let RefundVault = artifacts.require('./zeppelin/contracts/crowdsale/RefundVault.sol');

const config  = require('./../config.js');

module.exports = async function(deployer, network, accounts) {

    const crowdsaleWallet = accounts[0];
    const teamWallet = accounts[1];
    const foundationWallet = accounts[2];

    await deployer.deploy(StentorToken, config.initialSupply);
    await deployer.deploy(RefundVault, crowdsaleWallet);
    await deployer.deploy(StentorCrowdsale, config.startTime, config.endTime, config.rate, config.goal, config.cap, RefundVault.address, StentorToken.address, {gas: 999999});

    //allocate SGT for the crowdsale, team, and foundation
    await StentorToken.deployed().then(async (token) => {
        await token.transfer(StentorCrowdsale.address, config.cap);
        await token.transfer(teamWallet, config.team.amount);
        await token.transfer(foundationWallet, config.foundation.amount);
    });
};
