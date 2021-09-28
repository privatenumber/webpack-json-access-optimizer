const { hasOwnProperty } = Object.prototype;

export function toPOJO<T>(object: T) {
	if (!object || typeof object !== 'object') {
		return object;
	}

	const cloned: Record<string, any> = {};

	for (const propertyName in object) {
		if (hasOwnProperty.call(object, propertyName)) {
			cloned[propertyName] = toPOJO(object[propertyName]);
		}
	}

	return cloned as T;
}
