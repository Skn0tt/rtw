import { makeDerivedValue, makeLiveValue } from "../src";


const input = makeLiveValue<number, void[]>(send => () => {
    setInterval(() => {
        const x: number = Math.random()
        console.log('new Number: ', x)
        send(x)
    }, 500)
})

const average = makeDerivedValue<void[], number>(() => {
    let state: { n: number, avg: number } = { avg: 0, n: 0 }
    return () => {
        const newNumber = input()
        state = {
            n: state.n + 1, avg:
                (state.n * state.avg + newNumber)
                / (state.n + 1)
        }
        return state.avg;
    }
}, 'average')

const min = makeDerivedValue<void[], number>(() => {
    let minNumber: number = 1
    return () => {
        const newNumber = input()
        minNumber = Math.min(minNumber, newNumber)
        return minNumber
    }
}, 'min')

const difference = makeDerivedValue<void[], number>(() => () => {
    const currentMin = min()
    const currentAvg = average()
    return currentAvg - currentMin;
}, 'average')

min.subscribe([],v=>console.log('min', v))
average.subscribe([],v=>console.log('avg ', v))
difference.subscribe([], v => console.log('difference: ', v))