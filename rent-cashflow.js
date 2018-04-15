/*
This is a Google Apps Script function for use in Google sheets. It takes input from Yardi rent roll (Tenancy II format), 
and outputs the rental cash flow for each tenant on a separate line.
Dependencies: moment.js
*/
//
//eslint settings:
/*global moment  */
//
//-----------------------------------------------------------------------------
//"buildCF" is the main custom function to be called from Google Sheets
//Inputs for this function are:
//	builtInputArray = array of rent roll from Google Sheets
//	buildStartDate = date to start cash flow projections
//	buildEndDate = date to end cash flow projections
//	forecastInputArray = array of the forecast variables (OPTIONAL)
function buildCF(buildInputArray, buildStartDate, buildEndDate, forecastInputArray) { //eslint-disable-line no-unused-vars
	var buildOutputArray = []; //Master output array
	var masterDatesArray = []; //Array of dates in index 0 position
	var spaceAfterForecast = true;
	var spaceAfterEachTenant = true;
	var i = 0, j = 0; //var in FOR loops
	
	//Create a new Property object with input array
	var currentPropObject = new Property(buildInputArray); 
	var maxLoopTenants = currentPropObject.tenantCount;

	//Error checking for lack of input	
	if (arguments.length < 3) {
		buildOutputArray.push('Error: Not enough inputs');
	}

	//This bloack below is the main block. If number of arguments suffices, proceed with main function.
	if (arguments.length >= 3 && (buildStartDate !== '' && buildEndDate !== '')) {
		
		masterDatesArray = genArrayDates(buildStartDate, buildEndDate);
				
		//Statement below sets line 0 of output array to be masterDatesArray (beginDate to endDate)
		buildOutputArray[0] = masterDatesArray; 
		

		//Loop through all tenants in currentPropObject and push cash flow into master output array (buildOutputArray)
		var arrayOfRents = [];
		var buildOutputRow = 0; 
		var currTenantObjectI = 0;
		var forecastArrayRow = 3;
		
		//Each loop below is one Tenant Object in propObject.rentRoll[i]
		for (currTenantObjectI = 0; currTenantObjectI < maxLoopTenants; currTenantObjectI++) {
			var currentTenantInThisLoop = currentPropObject.rentRoll[currTenantObjectI]; 
			var buildLeaseName = currentTenantInThisLoop.lease;
			var queryRentArray = currentTenantInThisLoop.rentArray;
			var passLeaseStart = currentTenantInThisLoop.leaseStartDate;
			var passLeaseEnd = currentTenantInThisLoop.leaseEndDate;

			if (spaceAfterEachTenant) {addEmptyRow();}

			arrayOfRents = rentCF(masterDatesArray, queryRentArray, passLeaseStart, passLeaseEnd); 
			arrayOfRents.unshift(buildLeaseName); //Unshifts tenant name to first position of rent $ array

			//buildOutputRow = currTenantObjectI + 1; 

			buildOutputRow++;
			buildOutputArray[buildOutputRow] = arrayOfRents;
			arrayOfRents = [];

			//----------- Forecast Section below -------------------
			//Function below calls forecast tenant cash flow function if forecast array is given as an input			
			forecastArrayRow = 3; //reset the forecastArray row counter to top of the table
			
			if (forecastInputArray !== '' && 
				forecastInputArray[0][0] == 'Forecast Cash Flow Assumptions' && 
				forecastInputArray[0].length == 8) {

				for (forecastArrayRow = 3; forecastArrayRow < forecastInputArray.length; forecastArrayRow++) {					
					if (forecastInputArray[forecastArrayRow][0] == currentTenantInThisLoop.leaseName) {
						forecastTenantCF(currentTenantInThisLoop, forecastInputArray); //passes current Tenant Object and forecast table
						if (spaceAfterForecast && !spaceAfterEachTenant) {addEmptyRow();}
						
						//buildOutputArray[buildOutputRow] = arrayOfRents; //consider moving this to the sub-function
						arrayOfRents = []; //consider moving this to the sub-function		
					}
				}
			} //close forecast function
		} //close each loop through each tenant		

		//Unshift first column "Date" to row [0] of master output array
		buildOutputArray[0].unshift('Dates');
		
	} //close initial check that enough arguments are available for function

	return buildOutputArray;

	//----------------------------------------------------------------------------------
	function addEmptyRow () {
		buildOutputRow++; 
		buildOutputArray[buildOutputRow] = ' ';
		return;
	}

	//----------------------------------------------------------------------------------
	function forecastTenantCF (forecastInputTenantObject, arrayOfForecastVariables) {
		console.log('Forecast function is triggered');

		//Col variables for arrayOfForecastVariables[x][...Col] given below
		var tenantBindingCol = 0;
		var profileNameCol = 1;
		var leaseTimeCol = 2;
		var leaseTermCol = 3;
		var tiCol = 4;
		var lcCol = 5;
		var rentPSFCol = 6;
		var inflationCol = 7;
		
		//Init variables below. 'fc' is shorthand for 'forecast' in variable names
		var fcTenantBinding = forecastInputArray[forecastArrayRow][tenantBindingCol]; //eslint-disable-line no-unused-vars
		var fcProfileName = forecastInputArray[forecastArrayRow][profileNameCol]; 
		var fcLeaseTime = forecastInputArray[forecastArrayRow][leaseTimeCol]; //eslint-disable-line no-unused-vars
		var fcLeaseTerm = forecastInputArray[forecastArrayRow][leaseTermCol];
		var fcTI = forecastInputArray[forecastArrayRow][tiCol]; //eslint-disable-line no-unused-vars
		var fcLC = forecastInputArray[forecastArrayRow][lcCol]; //eslint-disable-line no-unused-vars
		var fcRent = forecastInputArray[forecastArrayRow][rentPSFCol]; //rent $ psf
		var fcInflation = forecastInputArray[forecastArrayRow][inflationCol]; //eslint-disable-line no-unused-vars
		var fcRentArray = []; //init 2d array for creating rentArray to pass to function: rentCF
		//deprecated var arrayRow = 0, arrayCol = 0; //init row and col variables of output Array to pass to function: rentCF
		var fcRentAmount = 0; //init var to hold rental $ amount per month for loading into rentArray
		var fcArea = currentTenantInThisLoop.area;
		var fcOutputArray = []; //init output array of dates to be returned
		var nextForecastBeginDate = moment('01/01/1900', 'MM/DD/YYYY').format('MM/DD/YYYY');
		var tempOneLineRentArray = [[]];
		var fcArrayRow = 0; //row counter for the fc Output Array

		//build a rentArray and pass it to rentCF
		var tenantLeaseEnd = eMonth(currentTenantInThisLoop.leaseEndDate);
		var loopLeaseEndDate = tenantLeaseEnd;
		var priorLoopLeaseEndDate = loopLeaseEndDate;		
					
		//var forecastDateBegin = moment(tenantLeaseEnd, 'MM/DD/YYYY').add(1, 'd').format('MM/DD/YYYY');
		//for loop to read all arrayOfForecastVariables
		
		//loop through empty rows below and build an additional crRent row for each row. Do/While loop is used so that the action is taken before checking for array[x][0] == ''

		tenantForecastBlock:
		do {
			nextForecastBeginDate = moment(priorLoopLeaseEndDate, 'MM/DD/YYYY').add(1, 'd').format('MM/DD/YYYY');
								
			//TO-DO allow the line below to read "renewal" which will take the last rent 
			fcProfileName = forecastInputArray[forecastArrayRow][profileNameCol];
			fcLeaseTerm = forecastInputArray[forecastArrayRow][leaseTermCol];
			fcRent = forecastInputArray[forecastArrayRow][rentPSFCol];
				
			//Code below returns the renewal rent if 'renew' is detected in the Forecast Array
			if (['renew','Renew','renewal','Renewal'].indexOf(fcRent) > -1) {
				fcRentAmount = (fcArea * (fcRent/12));
				var askLastLeaseDate = currentTenantInThisLoop.leaseEndDate;
				fcRentAmount = returnRentAmount(currentPropObject, currentTenantInThisLoop.leaseName, askLastLeaseDate);				
			} 
			
			else {
				fcRentAmount = (fcArea * (fcRent/12));
			}			

			fcRentArray.push([]); //push an empty array into the next index position 

			if(fcArea == 0) {
				buildOutputRow++;				
				fcOutputArray = [('     ' + fcProfileName + ':  No forecast because Lease Area = 0')];
				buildOutputArray[buildOutputRow] = fcOutputArray;
				
				//deprecated line below does not work as well:
				//buildOutputArray[buildOutputRow].push(fcOutputArray);
								
				break tenantForecastBlock;
			}

			fcRentArray[fcArrayRow][0] = nextForecastBeginDate; //rent start date
			fcRentArray[fcArrayRow][1] = fcRentAmount; //rent $ amount
			fcRentArray[fcArrayRow][2] = fcProfileName; //profile name						

			loopLeaseEndDate = moment(nextForecastBeginDate, 'MM/DD/YYYY').add(fcLeaseTerm - 1, 'M').format('MM/DD/YYYY');
			loopLeaseEndDate = eMonth(loopLeaseEndDate);			
			
			tempOneLineRentArray[0] = fcRentArray[fcArrayRow]; 
			fcOutputArray = rentCF(masterDatesArray, tempOneLineRentArray, nextForecastBeginDate, loopLeaseEndDate);								

			fcOutputArray.unshift('     ' + fcProfileName);
			
			buildOutputRow++; //increment masterOutputArray row to next row for rent array insertion
			buildOutputArray[buildOutputRow] = fcOutputArray;			
			
			//Get ready for next cycle of do {} loop
			priorLoopLeaseEndDate = loopLeaseEndDate;
			forecastArrayRow++;
			fcArrayRow++;
			fcOutputArray = []; //clear the array that gets pushed to the next row of the masterOutputArray
			fcRentAmount = 0;
			
			if (forecastArrayRow == arrayOfForecastVariables.length) {
				break;
			} 

		} while (arrayOfForecastVariables[forecastArrayRow][0] == '');				

		return;
	}
}

//Constructor function Tenant object
function Tenant(inLease, inLeaseStart, inLeaseEnd, inArea, inLeaseType, inRent) {
	this.rentArray = [];
	this.lease = inLease; //Name of the lease
	this.leaseName = inLease; //Synonym for name of lease
	this.leaseStartDate = moment(inLeaseStart).format('MM/DD/YYYY');
	this.leaseEndDate = moment(inLeaseEnd).format('MM/DD/YYYY');
	this.area = inArea; //Area of the lease
	this.leaseType = inLeaseType; //String with type of lease. e.g. 'Retail - NNN'
	this.rentArray = inRent; //2 dimensional array with rent escalation schedule

	return;
}

//-----------------------------------------------------------------------------
//Property constructor function
//Creates new Property Object with following objects:
//  prop.tenantCount; //Number of tenants in Property Object
//  prop.rentRoll[i]; //Rent roll in Property Object. Each [i] contains indexed Tenant Objects
//
//Inputs:
// 	rentRollArray = array of rent roll from Google sheets
//
function Property(rentRollArray) {
	
	//Init scope variables
	//Variables to set input array columns
	var testEmptyCol = 0;
	var leaseCol = 2;
	var areaCol = 7;
	var rentStepsTypeCol = 12;
	var rentDateCol = 13;
	var rentCostCol = 17;
	var leaseStartDateCol = 3;
	var leaseEndDateCol = 4;
	var leaseTypeCol = 10;
	
	//Variables for function
	var numberOfTenants = 0; //number of tenants
	var line = 0; //line of the rent roll array
	var rentArrayRow = 0; //row counter for crRent 
	var subLineX = 0; //row counter for crRent loop
	var crRent = []; //rent schedule array
	var crLease = ''; //lease name
	var crArea = 0; //lease area
	var crRentDate = moment(); //Temporary variable to loop through rent escalation schedule
	var crLeaseStart = moment(); //Moment object for start date of lease
	var crLeaseEnd = moment(); //Moment object for end date of lease
	var i = 0;
	var crLeaseType = '';
	//Deprecated Line below, GAS uses different format
	//var crRentDate = moment().format('MM/DD/YYY'); 
	
	crRentDate = '01/01/1900';	

	//Init Property Object
	var prop = new Object();
	prop.rentRoll = {}; //rentRoll object
	prop.tenantCount = 0; //number of tenants in property

	//Loop throug array and count number of tenants in rent roll
	for (i = 0; i < rentRollArray.length; i++) {
		if (rentRollArray[i][testEmptyCol] !== '') {
			numberOfTenants++;
		}
	}

	prop.tenantCount = numberOfTenants;
	
	//Main Loop: Loop through all rent roll and create Tenant Objects for Prop Object
	//Variable i in the loop below is the tenant number
	for (i = 0; i < (numberOfTenants); i++) {
		var tempRentCost = 0;
		var tempTypeOfRent = '';

		crLease = rentRollArray[line][leaseCol];
		crArea = rentRollArray[line][areaCol];
		crLeaseStart = rentRollArray[line][leaseStartDateCol];
		crLeaseEnd = rentRollArray[line][leaseEndDateCol];
		crLeaseType = rentRollArray[line][leaseTypeCol];

		rentArrayRow = 0;
		subLineX = (line + rentArrayRow);
		
		//Inner Loop: Loop through rent schedule and push data into crRent[]
		do {		
			crRentDate = rentRollArray[subLineX][rentDateCol];
			crRentDate = moment(crRentDate).format('MM/DD/YYYY');
			//Deprecated Line below, GAS uses different format
			//crRentDate = moment(crRentDate, 'MM/DD/YYYY').format('MM/DD/YYYY'); 
			
			tempRentCost = rentRollArray[subLineX][rentCostCol];
			tempTypeOfRent = rentRollArray[subLineX][rentStepsTypeCol];
						
			crRent[rentArrayRow] = [crRentDate, tempRentCost, tempTypeOfRent]; 
			
			rentArrayRow++;
			subLineX = (line + rentArrayRow);

			if(subLineX >= rentRollArray.length) {break; }
		}	while (rentRollArray[subLineX][testEmptyCol] == '');

		//Load rentRoll object with new Tenant object
		prop.rentRoll[i] = new Tenant(crLease, crLeaseStart, crLeaseEnd, crArea, crLeaseType, crRent);
		line += rentArrayRow;

		//Reset variables before restarting loop
		crLease = 'error';
		crArea = 0;
		crRent = [];
		crRentDate = '01/01/1900';
	}
	return prop;
}

//-----------------------------------------------------------------------------
//Function - given an input ArrayA of dates, and an input 2 dimensional ArrayB of rent Schedule,
//Returns an outputArray of outputArray.length = ArrayA, with base rent matching the dates in ArrayA in position
//This allows user to push outputArray into ArrayA to generate a masterArray of cash flows
//Inputs:
//	arrayOfDates: Must be a 1 dimensional array of only moment.js dates
//	arrayRent: Must be a 2 dimensional array with dates in [x][0] and $ rent in [x][1]
function rentCF(arrayOfDates, arrayRent, inputLeaseStart, inputLeaseEnd) { 
	var arrDatesMax = arrayOfDates.length;
	var arrRentMax = arrayRent.length;
	var setRent = 0;
	var arrayCurrMonth = moment('01/01/1900', 'MM/DD/YYYY').format('MM/DD/YYYY');
	var rentSchedCurrMonth = moment('01/01/1900', 'MM/DD/YYYY').format('MM/DD/YYYY');
	var outputArray = [];
	var rentCFi = 0;
	var typeOfRentInFirstYear = arrayRent[0][2];
	var positionFirstDate = 0; //Col index position number of first date in masterArrayOfDates
	
	//Checks if the first line of arrayRent is 'rentabat' type
	//If yes, modifies arrayRent into arrayRentModified and calls rentCF with the new arrayRentModified
	//Note that this function assumes the rent abatement period (first row of rent array) is equal
	//in time to the rent period in the second row of the array	
	//TO-DO: ADJUST RECURSIVE FUNCTION SO THAT IT RECURSIVELY ELIMINATES ALL 'rentabat' ROWS FROM rentArray
	if (typeOfRentInFirstYear == 'rentabat') {
		var outputArrayAbat = [];
		console.log('Rent abatement modification is triggered. Input rent array = ' + arrayRent.length);
		var arrayRentModified = [[]];
		var maxModLoop = arrayRent.length;
		var arrayRentModifiedI = 2; //Loop counter starts at 3rd row of arrayRent because rows 1 & 2 are combined
		
		arrayRentModified[0][0] = arrayRent[0][0];
		arrayRentModified[0][1] = (arrayRent[0][1] + arrayRent[1][1]);
		arrayRentModified[0][2] = 'rentbase';

		for (arrayRentModifiedI = 2; arrayRentModifiedI < maxModLoop; arrayRentModifiedI++) {
			arrayRentModified[arrayRentModifiedI - 1] = arrayRent[arrayRentModifiedI];
		}		
		outputArrayAbat = rentCF(arrayOfDates, arrayRentModified, inputLeaseStart, inputLeaseEnd);
		return outputArrayAbat;		
	}
	//If no rent abatement in rentArray, continue on below:
	//
	else {
		
		//if current date is past the expiration date, then set rent to zero
		//Sets the rent level to earliest rent in arrayRent at the first outputArray position
		for (j = (arrRentMax - 1); j >= 0; j--) {
			arrayCurrMonth = eMonth(arrayOfDates[positionFirstDate]); //Be careful not to be querying the first array position which is the string 'Dates'
			rentSchedCurrMonth = eMonth(arrayRent[j][0]);		

			//TO-DO: NEED TO FIX MOMENT.JS ERROR BELOW:
			var testIfDateAfter = moment(arrayCurrMonth, 'MM/DD/YYYY').isSameOrAfter(rentSchedCurrMonth);
			var testIfBeforeLeaseExpire = moment(arrayCurrMonth, 'MM/DD/YYYY').isSameOrBefore(inputLeaseEnd);
			
			if (testIfDateAfter && testIfBeforeLeaseExpire) {		
				setRent = arrayRent[j][1];
				break;
			}
		}
		outputArray.push(setRent);
		
		for (rentCFi = 1; rentCFi < arrDatesMax; rentCFi++) {

			testIfDateAfter = moment(arrayCurrMonth, 'MM/DD/YYYY').isSameOrAfter(inputLeaseEnd);

			if (testIfDateAfter) { //Test if curr Array Date is after lease expiration
				setRent = 0;} //If true, set Rent = $0 and break to the next date in for loop
			else { //If false, run loop below to retrieve the correct rent $ to push into the output Array

				for (j = 0; j < arrRentMax; j++) {
					arrayCurrMonth = eMonth(arrayOfDates[rentCFi]);
					rentSchedCurrMonth = eMonth(arrayRent[j][0]);

					if (arrayCurrMonth == rentSchedCurrMonth) {
						setRent = arrayRent[j][1];
						break;
					}
				}
			}

			outputArray.push(setRent);
		}
	}	
	return outputArray;
}

//-----------------------------------------------------------------------------
//Function generates 1 dimensional horizontal array of dates spanning two input dates
//Dates with array are last date of month
//Use this function to create Array of Dates and monthly base Rents
function genArrayDates(inputStartDate, inputEndDate) {
	var startDate = eMonth(new Date(inputStartDate));
	var endDate = eMonth(new Date(inputEndDate));
	var outArray = []; 
	var col = 0;
  
	var counterDate = startDate;
	var genArrA = moment(endDate, 'MM/DD/YYYY');
	var genArrB = moment(startDate, 'MM/DD/YYYY');
	var spanMonths = genArrA.diff(genArrB, 'months', true); //true returns floating point rather than truncated number
	spanMonths = Math.round(spanMonths); //rounding required to get integer month difference
  
	for (col = 0; col <= spanMonths; col++) { 
		outArray.push(counterDate);
		counterDate = addTime(counterDate, 1);    
	}
	return outArray;
}

//-----------------------------------------------------------------------------
//This function pushes individual elements from arrayB into arrayA rather than the
//entire arrayB into arrayA. In other words, output is [x, x, x] rather than [[x], [x], [x]]
function pushArray(pushReceiver, pushGiver) { //eslint-disable-line no-unused-vars
	var pushMaxLoop = pushGiver.length;
	var pushFuctionOutput = pushReceiver;
	var pushLoopI = 0;

	for (pushLoopI = 0; pushLoopI < pushMaxLoop; pushLoopI++ ) {
		pushFuctionOutput.push(pushGiver[pushLoopI]);
	}
	return pushFuctionOutput;
}

//-----------------------------------------------------------------------------
//Function returns the $ monthly rent, given a property object, a tenant and a date
//The tenant may be either an index number, or a lease name
//Inputs: 
//	prop = property object
//	inputTenant = tenant lease name
//	askingDate = date to query for rent
function returnRentAmount(prop, inputTenant, askingDate) { //eslint-disable-line no-unused-vars
	var rentOutput = 0;
	var queryDate = moment(askingDate, 'MM/DD/YYYY').format('MM/DD/YYYY');
	var testA1 = moment(), testA2 = moment(), testB1 = moment(), testB2 = moment(), testC1 = moment(), testC2 = moment(); 
	
	if (typeof(inputTenant) == 'string') {
		for (i = 0; i < prop.tenantCount; i++) {
			if (prop.rentRoll[i].lease == inputTenant) {
				inputTenant = i; 
				break;
			}
		}
	} 

	var loopMax = prop.rentRoll[inputTenant].rentArray.length;
	var targetTenant = prop.rentRoll[inputTenant]; 	
	
	if (typeof(inputTenant) == 'number') {
		testA1 = moment(queryDate).isAfter(targetTenant.leaseEndDate);
		testA2 = moment(queryDate).isBefore(targetTenant.leaseStartDate);
		if (testA1 || testA2) {
			rentOutput = -999;
			return rentOutput;
		}

		testB1 = moment(queryDate).isSameOrAfter(targetTenant.rentArray[(loopMax - 1)][0]);
		testB2 = moment(queryDate).isSameOrBefore(targetTenant.leaseEndDate);
		if (testB1 && testB2) {
			rentOutput = targetTenant.rentArray[(loopMax - 1)][1];
			return rentOutput;
		}

		for (i = 0; i < loopMax; i++) {
			testC1 = moment(queryDate).isSameOrAfter(targetTenant.rentArray[i][0]);
			testC2 = moment(queryDate).isBefore(targetTenant.rentArray[(i + 1)][0]);
			if (testC1 && testC2) {
				rentOutput = targetTenant.rentArray[i][1];				
			}
		}
	}	
	return rentOutput;	
}

//Helper function below to debug tenant list in Property Object
function printAllTenants(inputPropObject) { //eslint-disable-line no-unused-vars
	var maxPrintLoop = inputPropObject.tenantCount;

	for (i = 0; i < maxPrintLoop; i++) {
		document.write(inputPropObject.rentRoll[i].leaseName);
		document.write('<br>');
		
		if ((i + 1) == maxPrintLoop) {
			document.write('-----------------------------');
		}
	}
}

//-----------------------------------------------------------------------------
//Function below is deprecated genArrayDates b/c it outputs an undesirable [[]] array of dates
//Function generates horizontal array of dates spanning two input dates
//Dates with array are last date of month
//Use this function to create Array of Dates and monthly base Rents
function genArrayDatesDeprecated(inputStartDate, inputEndDate) { //eslint-disable-line no-unused-vars
	var startDate = eMonth(new Date(inputStartDate));
	var endDate = eMonth(new Date(inputEndDate));
	//var outArray = [[], []];
	//Changed to var below rather than [[], []]. This eliminates empty array in row 2:
	//Using [] below generates a TypeError
	var outArray = [[]]; 
	var col = 0;
  
	var counterDate = startDate;
	var genArrA = moment(endDate, 'MM/DD/YYYY');
	var genArrB = moment(startDate, 'MM/DD/YYYY');
	var spanMonths = genArrA.diff(genArrB, 'months', true); //true returns floating point rather than truncated number
	spanMonths = Math.round(spanMonths); //rounding required to get integer month difference
  
	for (col = 0; col <= spanMonths; col++) { 
		outArray[0][col] = counterDate;
		counterDate = addTime(counterDate, 1);    
	}
	document.write('length of outarray = ' + outArray.length);    
	return outArray;
}

//-----------------------------------------------------------------------------
//Function outputs last date of month
function eMonth(inputDate) {
	var eMonthTempDate = new Date(inputDate); //not necessary if input is strictly date
	var eMonthEndDate = moment(eMonthTempDate, 'MM/DD/YYYY').endOf('month');
	var eMonthOutputDate = moment(eMonthEndDate, 'MM/DD/YYYY').format('MM/DD/YYYY');
  
	return eMonthOutputDate;
}

//-----------------------------------------------------------------------------
//Function outputs incremented date
//Option to increment by day, month or year. Default is month
//To-Do: This function always outputs last date of month even if 'd' unit is used!
function addTime(inputDate, increment, inputUnit) {
	var tempDate = new Date(inputDate);
  
	var unit = 'M';

	switch(inputUnit) {
	case 'd':
		unit = 'd';
		break;
	case 'y':
		unit = 'y';
		break;
	default:
		unit = 'M';
	}
      
	var draftOutputDate = moment(tempDate, 'MM/DD/YYYY').add(increment, unit);
	draftOutputDate = eMonth(draftOutputDate);
	var outputDate = moment(draftOutputDate, 'MM/DD/YYYY').format('MM/DD/YYYY');
  
	return outputDate;
}
