import React, { useState, useEffect } from 'react'
import { api } from './API'
import './AccountOrders.css'
import './Table.css'
import { useHistory } from 'react-router-dom'
import LoadingOverlay from './LoadingOverlay'
import InfoBox from './InfoBox'
import { IconConverter } from 'icon-sdk-js'
import { convertTsToDate } from './utils'

const AccountOrders = ({ wallet }) => {
    const [openSwaps, setOpenSwaps] = useState(null)
    const [filledSwaps, setFilledSwaps] = useState(null)
    const [errorUi, setErrorUi] = useState(null)
    const [loadingText, setLoadingText] = useState('Loading account...')
    const [intervalHandle, setIntervalHandle] = useState(null)
    const [withdrawingInProgress, setWithdrawingInProgress] = useState(null)
    const history = useHistory();

    history.listen((location, action) => {
        intervalHandle && clearInterval(intervalHandle)
    })


    useEffect(() => {

        const swapCancel = (swap) => {
            return swap && swap['status'] === 'CANCELLED'
        }

        const refreshSwap = (swap) => {
            return api.getSwap(parseInt(swap['id'])).then(newSwap => {
                if (swapCancel(newSwap)) {
                    setWithdrawingInProgress(null);
                    setOpenSwaps(null);
                }
            })
        }

        if (withdrawingInProgress) {
            if (!intervalHandle) {
                setIntervalHandle(setInterval(() => {
                    refreshSwap(withdrawingInProgress)
                }, 1000))
            }
        } else {
            if (intervalHandle) {
                clearInterval(intervalHandle)
                setIntervalHandle(null)
            }
        }
    }, [withdrawingInProgress, setOpenSwaps, setWithdrawingInProgress]);

    const getAllSwapDetails = (swaps) => {
        const promises = Object.entries(swaps).map(([key, swap]) => {
            swap['timestamp_create'] = convertTsToDate(swap['timestamp_create'])
            swap['timestamp_swap'] = convertTsToDate(swap['timestamp_swap'])
            return api.getTokenDetails(wallet, swap['maker']['contract']).then(details => {
                swap['maker']['token'] = details
                return api.getTokenDetails(wallet, swap['taker']['contract']).then(details => {
                    swap['taker']['token'] = details
                    return api.balanceToFloat(swap['taker']['amount'], swap['taker']['contract']).then(balance => {
                        swap['taker']['amountDisplay'] = balance
                        return api.balanceToFloat(swap['maker']['amount'], swap['maker']['contract']).then(balance => {
                            swap['maker']['amountDisplay'] = balance
                            return swap
                        })
                    })
                })
            })
        })

        return Promise.all(promises).then(result => {
            return result
        })
    }

    !openSwaps && api.getPendingOrdersByAddress(wallet).then(swaps => {
        getAllSwapDetails(swaps).then(result => {
            // reverse chronological order
            setOpenSwaps(result.reverse())
        })
    })

    !filledSwaps && api.getFilledOrdersByAddress(wallet).then(swaps => {
        getAllSwapDetails(swaps).then(result => {
            // reverse chronological order
            setFilledSwaps(result.reverse())
        })
    })

    const goToSwap = (swap) => {
        window.open("#/swap/" + parseInt(swap['id'], 16), '_blank')
    }

    const onClickWithdraw = (swap) => {
        api.cancelSwap(wallet, parseInt(swap['id'])).then((tx) => {
            if (tx) {
                setWithdrawingInProgress(swap)
                setLoadingText('Withdrawing funds...')
            }
        }).catch(error => {
            setWithdrawingInProgress(null)
            setErrorUi(error)
        })
    }

    const over = (openSwaps !== null && filledSwaps !== null) && (!withdrawingInProgress)

    const getPrice = (o1, o2) => {
        return parseFloat(
            IconConverter.toBigNumber(o1['amount'])
                .dividedBy(IconConverter.toBigNumber(o2['amount']))
                .toFixed(8)).toString()
    }

    return (<>

        <LoadingOverlay over={over} text={loadingText} />
        {errorUi && <InfoBox setErrorUi={setErrorUi} type={"error"} content={"An error occured : " + errorUi} />}

        <div id="account-orders-root">
            {over && <>
                <div id="account-orders-container">
                    <div className="container-swaps-item">
                        <div className="container-swaps-item-container">
                            <div className="account-orders-title">My Opened Swaps</div>

                            <div className="swaps-table-view">
                                <table className="swaps-table" cellSpacing='0'>

                                    <thead>
                                        <tr>
                                            <th className="account-offer">Offer</th>
                                            <th className="account-receive">Receive</th>
                                            <th className="account-price">Price</th>
                                            <th className="account-creation">Creation</th>
                                            <th className="account-action">Action</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {openSwaps && Object.keys(openSwaps).map(order => (
                                            <tr className="account-tr-clickeable"
                                                onClick={() => { goToSwap(filledSwaps[order]) }}
                                                key={order}>
                                                <td>{openSwaps[order]['maker']['amountDisplay'] + " " + openSwaps[order]['maker']['token']['symbol']}</td>
                                                <td>{openSwaps[order]['taker']['amountDisplay'] + " " + openSwaps[order]['taker']['token']['symbol']}</td>
                                                <td>
                                                    1 {openSwaps[order]['maker']['token']['symbol']} ≈&nbsp;
                                                    {getPrice(openSwaps[order]['taker'], openSwaps[order]['maker'])}&nbsp;
                                                    {openSwaps[order]['taker']['token']['symbol']}
                                                    <br />
                                                    1 {openSwaps[order]['taker']['token']['symbol']} ≈&nbsp;
                                                    {getPrice(openSwaps[order]['maker'], openSwaps[order]['taker'])}&nbsp;
                                                    {openSwaps[order]['maker']['token']['symbol']}
                                                </td>
                                                <td>{openSwaps[order]['timestamp_create']}</td>
                                                <td className={"open-orders-actions"}>
                                                    {<button className={"open-orders-actions-button"}
                                                        onClick={() => { onClickWithdraw(openSwaps[order]) }}>Withdraw</button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div className="container-swaps-item">
                        <div className="container-swaps-item-container">
                            <div className="account-orders-title">My Filled Swaps</div>

                            <div className="swaps-table-view">
                                <table className="swaps-table" cellSpacing='0'>

                                    <thead>
                                        <tr>
                                            <th className="account-offer">Offer</th>
                                            <th className="account-receive">Receive</th>
                                            <th className="account-price">Price</th>
                                            <th className="account-filled">Filled</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filledSwaps && Object.keys(filledSwaps).map(order => (
                                            <tr className="account-tr-clickeable"
                                                onClick={() => { goToSwap(filledSwaps[order]) }}
                                                key={order}>
                                                <td className={(filledSwaps[order]['maker']['provider'] === wallet ? "order-filled-sell" : "order-filled-buy")}>
                                                    {filledSwaps[order]['maker']['amountDisplay'] + " " + filledSwaps[order]['maker']['token']['symbol']}</td>
                                                <td className={(filledSwaps[order]['taker']['provider'] === wallet ? "order-filled-sell" : "order-filled-buy")}>
                                                    {filledSwaps[order]['taker']['amountDisplay'] + " " + filledSwaps[order]['taker']['token']['symbol']}</td>
                                                <td>
                                                    1 {filledSwaps[order]['maker']['token']['symbol']} ≈&nbsp;
                                                    {getPrice(filledSwaps[order]['taker'], filledSwaps[order]['maker'])}&nbsp;
                                                    {filledSwaps[order]['taker']['token']['symbol']}
                                                    <br />
                                                    1 {filledSwaps[order]['taker']['token']['symbol']} ≈&nbsp;
                                                    {getPrice(filledSwaps[order]['maker'], filledSwaps[order]['taker'])}&nbsp;
                                                    {filledSwaps[order]['maker']['token']['symbol']}
                                                </td>
                                                <td>{filledSwaps[order]['timestamp_swap']}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className={"filled-swaps-legend"}>
                            <div className={"filled-swaps-legend-container"}>
                                <p><font color="green">● Bought</font></p>
                                <p><font color="red">● Sold</font></p>
                            </div>
                        </div>
                    </div>
                </div>
            </>}
        </div >
    </>)
}

export default AccountOrders