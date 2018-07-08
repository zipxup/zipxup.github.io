//initialize link
var Link = function(x, y, length, angle){
	this._startX = x;
	this._startY = y;
	this._length = length;
	this._angle = angle;
	this._parent = null;
}

//get every link's end position
Link.prototype.getEndX = function(){
	return this._startX + Math.cos(this._angle) * this._length;
}
Link.prototype.getEndY = function(){
	return this._startY + Math.sin(this._angle) * this._length;
}

//draw every link independently
Link.prototype.draw = function(context){
	context.strokeStyle = "black";
	context.lineWidth = 5;
	context.beginPath();
	context.moveTo(this._startX, this._startY);
	context.lineTo(this.getEndX(), this.getEndY());
	context.closePath();
	context.stroke();
}

//initialize link system
var LinkSystem = function(x, y){
	this._x = x;
	this._y = y;
	this._links = [];
	this._lastLink = null;
	this._totalLength = 0;
	this._endX = null;
	this._endY = null;
	this._prevEndX = null;
	this._prevEndY = null;
}

//add a new vertical link to the last link's end.
LinkSystem.prototype.addLink = function(length){
	var link = new Link(0, 0, length, 0.5 * Math.PI);
	if(this._lastLink){
		link._startX = this._endX;
		link._startY = this._endY;
		link._parent = this._lastLink;
	}
	else{
		link._startX = this._x;
		link._startY = this._y;
	}
	this._endX = link.getEndX();  
	this._endY = link.getEndY();
	this._links.push(link);
	this._lastLink = link;
	this._totalLength += length;
}


//check whether the end position is at the goal position.
LinkSystem.prototype.isReached = function(goalX, goalY){
	//set an error tolerance.
	if(Math.abs(this._endX - goalX) <= 5 && Math.abs(this._endY - goalY) <= 5)
		return true;

	// if the goal cannot be achieved with the current links length,
	// then if the current position only has a little difference with the previous
	// return true.
	if(Math.abs(this._prevEndX - this._endX) < 0.001 && 
		Math.abs(this._prevEndY - this._endY) < 0.001)
		return true;

	return false;
}

LinkSystem.prototype.reachByCCD = function(goalX, goalY){
	//if the end effector reach the goal point, then stop.
	if(this.isReached(goalX, goalY)){
		return;
	}
	this._prevEndX = this._endX;
	this._prevEndY = this._endY;

	var link = this._lastLink;
	while(link){
		//calculate angle using law of cosines. 
		var RE = [link._startX - this._endX, link._startY - this._endY, 0];
		var RG = [link._startX - goalX, link._startY - goalY, 0];
	
		RE = math.divide(RE, math.norm(RE));
		RG = math.divide(RG, math.norm(RG));	
		var angle = Math.acos(math.dot(RE, RG));
		//use cross product to decide whether the angle is positive or negative.
		var direction = math.cross(RE, RG);
		if(direction[2] < 0){
			angle = -angle;
		}
		//smaller each step to make the change more stable.
		link._angle = (link._angle + 0.1 * angle) % (2 * Math.PI);
		
		//with every updated joint's angle, we should update all links' position
		this.updateLink();
		link = link._parent;
	}
}

LinkSystem.prototype.reachByJacobian = function(goalX, goalY){
	//if the end effector reach the goal point, then stop.
	if(this.isReached(goalX, goalY)){
		return;
	}
	this._prevEndX = this._endX;
	this._prevEndY = this._endY;
	
	var g = [goalX, goalY, 0];
	var e = [this._endX, this._endY, 0];
	var derivatives = [];
	for(var i = 0; i < this._links.length; i++){
		//use axis and pivot point of the joint to calculate 
		//how e would change if we rotated around the axis
		var p = [this._links[i]._startX, this._links[i]._startY, 0];
		var diff = math.subtract(e, p);
		//give a smaller step.
		diff = math.divide(diff, 100);
		//it is 2D, so the rotation axis is z-axis
		derivatives[i] = math.cross([0, 0, 1], diff);
	}

	//use transpose matrix as the inverse matrix
	var matrixTranspose = math.matrix(derivatives);
	var jacobianMatrix = math.transpose(matrixTranspose);
	var matrixInverse = matrixTranspose;
	// var matrixInverse = math.multiply(math.inv(
	// 	math.multiply(matrixTranspose, jacobianMatrix)), matrixTranspose);

	//pick approximate step to take
	var diffE = math.subtract(g, e);
	//normalize diffE vector to take a small step
	diffE = math.divide(diffE, math.norm(diffE));

	//compute change in joint DOFs
	var diffAngles = math.multiply(matrixInverse, diffE);

	for(var i = 0; i < this._links.length; i++){
		//changed angle with a smaller one to make the movement more stable.
		//modulo part is to ensure joint's angle always within (0, 2*PI)
		this._links[i]._angle = (this._links[i]._angle + 0.03 * diffAngles._data[i]) % (2 * Math.PI);
	}
	this.updateLink();
}

//changed link's every joint position with its updated angle.
LinkSystem.prototype.updateLink = function (){
	[lastX, lastY] = [this._x, this._y];
	for(var i = 0; i < this._links.length; i++){
		var link = this._links[i];
		link._startX = lastX;
		link._startY = lastY;
		lastX = link.getEndX();
		lastY = link.getEndY();
	}
	this._endX = lastX;
	this._endY = lastY;
}

//draw the whole link system
LinkSystem.prototype.draw = function(context){
	for(var i = 0; i < this._links.length; i++){
		this._links[i].draw(context);
	}
}

//give 2 goal position with 1 mouse clicking
var splitMouseClick = function(e, width){
	var leftX, leftY, rightX, rightY;
	if(e.pageX <= width / 2){
		leftX = e.pageX;
		rightX = e.pageX + width / 2;
	}
	else{
		rightX = e.pageX;
		leftX = e.pageX - width / 2;
	}
	leftY = rightY = e.pageY;
	return [leftX, leftY, rightX, rightY];
}

//draw a square with center at (goalX, goalY)
var drawGoalPoint = function(context, goalX, goalY, color){
	context.fillStyle = color;
	context.fillRect(goalX - 5, goalY - 5, 10, 10);
}

//this line is to seperate left side and right side
var drawDivideLine = function(context, width, height){
	context.strokeStyle = "#aaa";
	context.lineWidth = 3;
	context.beginPath();
	context.moveTo(width/2, 0);
	context.lineTo(width/2, height);
	context.closePath();
	context.stroke();
}

window.onload = function(){
	var canvas = document.getElementById("canvas");
	var context = canvas.getContext("2d");
	var width = canvas.width = window.innerWidth;
	var height = canvas.height = window.innerHeight;

	//initialize link system on the left side, this one is implemented with CCD
	var linkSystemLeft = new LinkSystem(width/4, height/2);
	linkSystemLeft.addLink(height/8);
	linkSystemLeft.addLink(height/8);
	linkSystemLeft.addLink(height/8);

	//initialize link system on the right side, this one is implemented with Jacobian
	var linkSystemRight = new LinkSystem(3 * width/4, height/2);
	linkSystemRight.addLink(height/8);
	linkSystemRight.addLink(height/8);
	linkSystemRight.addLink(height/8);

	//initialize goal positions for left and right side.
	var goalXLeft = linkSystemLeft._endX,
		goalYLeft = linkSystemLeft._endY
		goalXRight = linkSystemRight._endX,
		goalYRight = linkSystemRight._endY;

	canvas.addEventListener("mousedown", function(e){
		[goalXLeft, goalYLeft, goalXRight, goalYRight] = splitMouseClick(e, width);
		//when mouse clicking position has been changed, clear previous end position.
		linkSystemLeft._prevEndX = linkSystemLeft._prevEndY = null;
		linkSystemRight._prevEndX = linkSystemRight._prevEndY = null;
	});
	
	update();
	function update(){
		linkSystemLeft.reachByCCD(goalXLeft, goalYLeft);
		linkSystemRight.reachByJacobian(goalXRight, goalYRight);

		//draw scene.
		context.clearRect(0, 0, width, height);
		drawDivideLine(context, width, height);
		drawGoalPoint(context, goalXLeft, goalYLeft, "green");
		drawGoalPoint(context, goalXRight, goalYRight, "green");
		linkSystemLeft.draw(context);
		linkSystemRight.draw(context);

		requestAnimationFrame(update);
	}
}