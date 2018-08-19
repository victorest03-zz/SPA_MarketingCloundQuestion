var Biotherm = {};

Biotherm.init = function(){
	var $ = jQuery;
	
	Biotherm.begin.init();
};

Biotherm.begin = {
	
	init: function()
	{
		var $ = jQuery,
			_this = Biotherm.begin;
		
		_this.$beginBtn = $('div#intro a.cta');
		
		_this.bindEvents();
	},
	
	bindEvents: function()
	{
		var $ = jQuery,
			_this = Biotherm.begin;
		
		_this.$beginBtn.click(function(e) {
			e.preventDefault();
			
			$('html,body').animate({
	        	scrollTop: $('section#register').offset().top
	        }, 1000);
	        
	        $(this).fadeOut();
		});
	}, // bindEvents()
}; // Biotherm.begin

$(document).ready(function(){
	Biotherm.init();
});