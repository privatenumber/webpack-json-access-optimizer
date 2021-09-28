type Position = {
	line: number;
	column: number;
}

type Location = {
	start: Position;
	end: Position;
}
const isPosition = (position: any): position is Position => (
	typeof position?.line === 'number'
	&& typeof position?.column === 'number'
);

const isSamePosition = (
	positionA: Position,
	positionB: Position,
) => (
	positionA.line === positionB.line
	&& positionA.column === positionB.column
);

export const isLocation = (location: any): location is Location => (
	isPosition(location?.start) && isPosition(location?.end)
);

export const isSameLocation = (
	locationA: Location,
	locationB: Location,
) => (
	isSamePosition(locationA.start, locationB.start)
	&& isSamePosition(locationA.end, locationB.end)
);
