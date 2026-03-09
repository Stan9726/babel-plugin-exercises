const base = 2;

function add(a, b) {
    return a + b;
}

function double(n) {
    return n * 2;
}

const result = double(add(base, 3));
console.log('result =', result);
