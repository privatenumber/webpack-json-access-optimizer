export function isSameArray<T>(
	arrayA: T[],
	arrayB: T[],
) {
	if (arrayA.length !== arrayB.length) {
		return false;
	}

	// eslint-disable-next-line unicorn/no-for-loop
	for (let i = 0; i < arrayA.length; i += 1) {
		if (arrayA[i] !== arrayB[i]) {
			return false;
		}
	}

	return true;
}
