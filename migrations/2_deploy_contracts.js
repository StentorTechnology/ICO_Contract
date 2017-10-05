let StentorCrowdsale = artifacts.require('./StentorCrowdsale.sol');
let StentorToken = artifacts.require('./StentorToken.sol');
let RefundVault = artifacts.require('./zeppelin/contracts/crowdsale/RefundVault.sol');
let VestedWallet = artifacts.require('./VestedWallet.sol');
let FoundationMultiSig = artifacts.require('./MultiSigWallet.sol');

const config  = require('./../config.js');

module.exports = async function(deployer, network, accounts) {

    const signers = [accounts[2], accounts[3], accounts[4]];
    const controller = accounts[1];

    await deployer.deploy(FoundationMultiSig, signers, 2);
    await deployer.deploy(StentorToken, config.initialSupply);
    await deployer.deploy(RefundVault, FoundationMultiSig.address);
    await deployer.deploy(StentorCrowdsale, config.startTime, config.endTime, config.rate, config.goal, config.cap, config.individualCap, RefundVault.address, StentorToken.address, controller, {gas: 4712388});
    await deployer.deploy(VestedWallet, FoundationMultiSig.address, StentorCrowdsale.address, StentorToken.address);

    //allocate SGT for the crowdsale, team, and foundation
    await StentorToken.deployed().then(async (token) => {
        // await token.transfer(StentorCrowdsale.address, config.cap);
        // the foundation will control the cap for pre-sale purposes
        await token.transfer(FoundationMultiSig.address, config.cap);
        await token.transfer(VestedWallet.address, config.team.amount);
        await token.transfer(FoundationMultiSig.address, config.foundation.amount);
    });

    //transfer control of the vault to the crowdsale
    await RefundVault.deployed().then(async (vault) => {
       vault.transferOwnership(StentorCrowdsale.address);
    });

    //transfer control of the crowdsale to the foundation's multisig
    await StentorCrowdsale.deployed().then(async (crowdsale) => {
       crowdsale.transferOwnership(FoundationMultiSig.address);
    });
};
