/**
 * DaaS
 *
 * Copyright (c) 2017 L'Oreal Canada
 */

'use strict';

if (typeof app === 'undefined') app = {};
if (typeof app.settings === 'undefined') app.settings = {};
if (typeof app.settings.cache === 'undefined') app.settings.cache = {};
if (typeof app.settings.cache.document === 'undefined') app.settings.cache.document = $(document);

/**
 * app.settings.get
 *
 * Get settings
 */
app.settings.get = function(setting, subkey) {
    var setting = typeof setting !== 'undefined' ? setting : '',
        subkey = typeof subkey !== 'undefined' ? subkey : '',
        value = '';
    if (this.hasOwnProperty(setting)) {
        if (!subkey) {
            value = this[setting];
        } else if (this[setting].hasOwnProperty(subkey)) {
            value = this[setting][subkey];
        }
    }
    return value;
}

/**
 * User
 *
 * User Model
 */
var User = Backbone.Model.extend({
    url: '/json/register.json',
    defaults: {
        name: '',
        email: '',
        locale: '',
        optin: '',
        optin_secondary: '',
        postalcode: '',
        birthday: '',
        is_existing: false,
        do_save: false
    },
    // parse response before saving to model
    parse: function(response){
        if (response.email) {
            this.trigger('check_email', response);
        }
    },
    // validate on model save before sending data
    validate: function(attrs) { 
        var emailFilter = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,6}$/,
            postalcodeFilter = app.settings.get('postalcode_regex'),
            errors = [];
        if (attrs.hasOwnProperty('email') && !emailFilter.test(attrs.email)) {
            errors.push({name: 'email', error: app.settings.get('error_message', 'email')});
        }
        if (attrs.hasOwnProperty('postalcode') && !postalcodeFilter.test(attrs.postalcode)) {
            errors.push({name: 'postalcode', error: app.settings.get('error_message', 'postalcode')});
        }
        if (errors.length > 0) {
           return errors;
        }
    }
});

/**
 * RegisterView
 *
 * Register View
 */
var RegisterView = Backbone.View.extend({
    el: $("#registration_wrapper"),
    events: {
        'click #submit_register': 'onSubmit',
        'click #register_yes': 'handleOptin',
        'click #register_no': 'handleOptout',
        'blur input': 'checkFields',
        'click #existing_sendemail': 'sendEmail',
        'click #existing_modify': 'stepToQuiz'
    },
    initialize: function() {
        this.name = this.$('input[name="name"]');
        this.email = this.$('input[name="email"]');
        this.locale = this.$('input[name="locale"]');
        this.optin = this.$('input[name="optin"]');
        this.optin_secondary = this.$('input[name="optin_secondary"]');
        this.postalcode = this.$('input[name="postalcode"]');
        this.listenTo(this.model, 'check_email', function(response) { this.processErrors(this.model.validate(response)); });
        this.listenTo(this.model, 'invalid', function(model, errors) { this.processErrors(errors); });
        this.listenTo(this.model, 'sync', function(model, response) { this.stepToExistingUser(response); });
        this.listenTo(this.model, 'error', function(model, error) { this.processSyncError(error); });
        this.listenTo(this, 'email_sent', this.stepToEmailConfirmation);
        app.settings.get('cache', 'document').trigger('diagnosticStepCompleted', {'step': 'init'});
    },
    onSubmit: function(e) {
        e.preventDefault();
        var self = this,
            attrs = {
                'do_save': false, //wip: request different URL for checking email exists
                'name': this.name.val(),
                'email': this.email.val(),
                'locale': this.locale.val(),
                'optin': typeof this.optin === 'boolean' ? this.optin : this.optin.is(':checked'),
                'optin_secondary': this.optin_secondary.is(':checked'),
                'postalcode': this.postalcode.val()
            },
            user = this.model.set(attrs);
            if (user) {
                user.save(null, {
                    data: 'rdata=' + JSON.stringify(user.attributes),
                    method: "GET"
                });
            }
    },
    checkFields: function(e) {
        var response = {},
            field = e.currentTarget.name,
            attrs = {};
        attrs[field] = this[field].val();
        this.processErrors(this.model.validate(attrs));
    },
    handleOptin: function(e) {
        this.optin = true;
        this.onSubmit(new Event('handleOptin'));
    },
    handleOptout: function(e) {
        this.optin = false;
        this.onSubmit(new Event('handleOptout'));
    },
    sendEmail: function(e) {
        e.preventDefault();
        var self = this,
            dataObj = self.model.toJSON();
        dataObj.tskey = app.settings.get('tskey');
        $.ajax({
            type: 'GET',
            url: '/json/send.json',
            data: 'tsData=' + encodeURIComponent(JSON.stringify(dataObj)),
            success: function(data) {
                if (data.error != 0) {
                    self.$('#register_error .error_message').html(app.settings.get('error_message', 'register')).parent().show();
                } else {
                    self.trigger('email_sent', data);
                }
            }
        });
    },
    processErrors: function(errors) {
        this.$('div.error_message').empty();
        if (typeof errors !== 'undefined' && errors.length > 0) {
            for (var key in errors) {
                if (errors.hasOwnProperty(key)) {
                    this.$('input[name="' + errors[key].name + '"]').closest('.cols').find('div.error_message').html('<span class="error_' + app.settings.get('locale') + '">' + errors[key].error + '</span>');
                }
            }
        }
    },
    processSyncError: function(error) {
        $('#register_error').show();
    },
    stepToExistingUser: function(response) {
        var self = this,
            response = typeof response !== 'undefined' ? response : {},
            error = typeof response.error !== 'undefined' ? response.error : 1,
            found = typeof response.found !== 'undefined' ? response.found : 0;
        $('div#intro a.cta').hide();
        if (error > 0) {
            this.$('#register_error .error_message').html(app.settings.get('error_message', 'register')).parent().show();
        } else if (!this.model.get('do_save')) {
            if (found == 1) {
                this.model.set({'is_existing': true});
                this.$('.error_message', '#register_error').hide();
                this.$('#register').fadeOut(300, function() {
                    self.$('#existing').fadeIn(300, function() {
                        app.settings.get('cache', 'document').trigger('diagnosticStepCompleted', {'step': 'existing-user-loaded'});
                    });
                });
            } else {
                this.trigger('load_quiz', response);
            }
        }
    },
    stepToEmailConfirmation: function(data) {
        var self = this;
        this.$('#existing').fadeOut(300, function() {
            self.$('#confirmation').fadeIn(300, function() {
                app.settings.get('cache', 'document').trigger('diagnosticStepCompleted', {'step': 'email-sent'});
            });
        });
        if (typeof this.$quizEl !== 'undefined') {
            $('#results', this.$quizEl).fadeOut(300, function() {
                $('#intro').fadeIn(300);
                $('#results_confirmation', self.$quizEl).fadeIn(300, function() {
                    app.settings.get('cache', 'document').trigger('diagnosticStepCompleted', {'step': 'email-sent'});
                });
            });
        }
    },
    stepToQuiz: function(e) {
        e.preventDefault();
        this.trigger('load_quiz');
    }
});

/**
 * Question
 *
 * Question Model
 */
var Question = Backbone.Model.extend({
    defaults: {
        id: 0,
        name: '',
        fr_ca_name: '',
        answers: {} 
    }
});

/**
 * Questions
 *
 * Questions Collection
 */
var Questions = Backbone.Collection.extend({
    model : Question,
    url: '/json/questions.json',
    parse: function(response) {
        return response.items;
    }
});

/**
 * QuestionView
 *
 * Question View
 */
var QuestionView = Backbone.View.extend({
    tagName: 'div',
    className: 'question_wrapper',
    template: _.template(this.$('#questionTemplate').html()),
    render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    }
});

/**
 * AppView
 *
 * App View
 */
var AppView = Backbone.View.extend({
    el: '#quiz_wrapper',
    events: {
        'submit form#quiz_form': 'onSubmit',
        'click div.question_wrapper label': 'handleNext',
        'change div.question_wrapper select': 'handleNext',
        'click #add_all': 'addAll',
        'click #send_results': 'sendEmail',
        'click #print_results': 'print',
        'click #restart': 'restart'
    },
    initialize: function() {
        this.user = new User;
        this.settings = app.settings; //wip: not in use yet
        this.registerView = new RegisterView({model: this.user});
        this.questions = new Questions();
        this.visibleQuestions = [];
        this.dataObj = {};
        this.dateData = {};
        this.userResults = [];
        this.listenTo(this, 'load_results', this.onSubmit);
        this.listenTo(this.registerView, 'load_quiz', this.render);
        this.listenTo(this.questions, 'sync', function(model, response) { this.showCollectionItems(response); }); // on fetch
        this.listenTo(this.questions, 'error', function(model, error) { this.processSyncError(error); });
    },
    templateQuiz: _.template(this.$('#quizTemplate').html()),
    templateResults: _.template(this.$('#resultsTemplate').html()),
    render: function() { //wip: move some lines into restart()
        // reinit
        this.dataObj = {};
        // show html
        $('#intro').show();
        this.$('#results').hide().html('<img src="' + app.settings.get('loading_img') + '" class="loading_img" />');
        this.$('#quiz').html('<img src="' + app.settings.get('loading_img') + '" class="loading_img" />');
        this.registerView.$el.fadeOut(300, function() {
            self.$('#quiz').fadeIn(300);
        });
        //if (!this.user.get('do_save')) { // comment out "if" statement to reload questions
            this.questions.fetch({data: {type: app.settings.get('type')}, processData: true});
        //}
    },
    handleStep: function(e, mode) { // wip: move next/prev to collection functions
        var self = this,
            mode = typeof mode !== 'undefined' ? mode : '',
            currentQuestionId = $(e.target).data('qid'),
            currentAnswerId = $(e.target).data('aid'),
            currentQuestionModel = this.questions.get(currentQuestionId),
            currentAnswers = currentQuestionModel.get('answers'),
            $currentQuestion = this.$('#question_' + currentQuestionId),
            currentIndex = this.visibleQuestions.indexOf(currentQuestionModel),
            newQuestionModel = '',
            transition = app.settings.get('transition'),
            flow = app.settings.get('flow'),
            completed = true;
        // nothing needed if no transition
        if (!transition) {
            return;
        }
        // exception for birthday select fields
        if (e.target.tagName == 'SELECT' && e.type == 'change') {
            this.dateData[e.currentTarget.name] = e.currentTarget.value;
            $('select', $currentQuestion).each(function() {
                if ($('option[disabled]:selected', this).length > 0) {
                    completed = false;
                }
            });
            if (completed) {
                // get age data (birthday, age range)
                var ageData = this.getAge(this.dateData);
                // errors
                if (!!ageData.error) {
                    errors.push({name: 'age', error: ageData.error});
                } else {
                    // set current answer ID with age range calculated from birthday
                    currentAnswerId = ageData.age_range;
                }
            }
        }
        // ready to go to next question
        if (completed) {
            switch (flow) {
                case 'tree':
                    // wip: dynamic question flow (move to separate method) + do "prev" mode
                    for (var i in currentAnswers) {
                        if (currentAnswers[i].aid == currentAnswerId && currentAnswers[i].hasOwnProperty('next_qid')) {
                            for (var j in this.visibleQuestions) {
                                if (this.visibleQuestions[j].id == currentAnswers[i].next_qid) {
                                    newQuestionModel = this.visibleQuestions[j];
                                    break;
                                }
                            }
                            break;
                        }
                    }
                    break;
                default:
                    // ordered question flow (not in use anymore)
                    switch (mode) {
                        case 'next':
                            var newIndex = currentIndex + 1,
                                newQuestionModel = newIndex < this.visibleQuestions.length ? this.visibleQuestions[newIndex] : '';
                            break;
                        case 'prev':
                            var newIndex = currentIndex - 1,
                                newQuestionModel = newIndex > -1 ? this.visibleQuestions[newIndex] : '';
                            break;
                        default:
                            var newQuestionModel = '';
                    }
            }
            if (newQuestionModel) {
                switch (transition) {
                    case 'fade':
                        $currentQuestion.fadeOut(300, function() {
                            self.$('#question_' + newQuestionModel.get('id')).fadeIn(300, function() {
                                app.settings.get('cache', 'document').trigger('diagnosticStepCompleted', {'step': 'next-question-loaded', 'qid': currentQuestionId});
                            });
                        });
                        break;
                }
            } else {
                $('input', $currentQuestion).on('change', function() {
                    self.onSubmit(new Event('handleLastStep'));
                });
            }
        }
    },
    handleNext: function(e) {
        this.handleStep(e, 'next');
    },
    handlePrev: function(e) {
        this.handleStep(e, 'prev');
    },
    restart: function() {
        this.user.set({'is_existing': true});
        this.render();
    },
    print: function() {
        window.print();
    },
    sendEmail: function() { // wip: bad...
        this.registerView.$quizEl = this.$el;
        this.registerView.sendEmail(event);
    },
    addAll: function() {
        var UPCs = [];
        for (var i in this.userResults) {
            if (this.userResults[i].hasOwnProperty('upc') && this.userResults[i].upc) {
                UPCs.push(this.userResults[i].upc);
            }
        }
        if (UPCs.length) {
            window.top.location.href = app.settings.get('add_all_url') + UPCs.join('_');
        }
    },
    getAge: function(args) {
        var args = typeof args !== 'undefined' ? args : {},
            day = args.hasOwnProperty('age_day') ? args.age_day : 0,
            month = args.hasOwnProperty('age_month') ? args.age_month : 0,
            year = args.hasOwnProperty('age_year') ? Number(args.age_year) : 0,
            userAge = new Date().getFullYear() - year,
            birthday = year + '-' + month + '-' + day,
            birthdayFilter = /^\d{4}-\d{1,2}-\d{1,2}$/,
            ageData = {birthday: '', age_range: '', error: false};
        // birthdate error
        if (!birthdayFilter.test(birthday)) {
            ageData.error = app.settings.get('birthdate');
            return ageData;
        }
        // set age range
        var answers = this.questions.get('age').get('answers'),
            ageRanges = [],
            ageRange = '',
            minRange = 0,
            maxRange = 0;
        // determine ranges from ids
        for (var i in answers) {
            if (answers[i].aid.indexOf('Under') !== -1) {
                ageRanges[i] = [0, answers[i].aid.slice(-2)];
            } else if (answers[i].aid.indexOf('Over') !== -1){
                ageRanges[i] = [answers[i].aid.slice(-2), 999];
            } else {
                ageRanges[i] = answers[i].aid.slice(-4).match(/.{2}/g).sort();
            }
        }
        // find the correct range given the user age
        for (var i in ageRanges) {
            minRange = Number(ageRanges[i][0]);
            maxRange = Number(ageRanges[i][1]);
            if (userAge >= minRange && userAge <= maxRange) {
                if (minRange == 0) {
                    ageRange = 'isUnder' + maxRange;
                } else if (maxRange == 999) {
                    ageRange = 'isOver' + minRange;
                } else {
                    ageRange = 'is' + minRange + maxRange;
                }
            }
        }
        // set birthday
        ageData.birthday = birthday;
        // set age range
        ageData.age_range = ageRange;
        // return
        return ageData;
    },
    onSubmit: function(e) { //wip
        e.preventDefault();
        var self = this,
            data = this.$(':input').serializeArray(),
            questionAnswers = {},
            userAnswers = {};
        for (var i in data) {
            this.dataObj[data[i].name] = data[i].value;
        }
        if (!this.validate()) {
            return;
        }
        data = 'data=' + encodeURIComponent(JSON.stringify({
            "email": this.user.get('email'), 
            "is_existing": this.user.get('is_existing'), 
            "type": app.settings.get('type'), 
            "answers": this.dataObj
        }));
        //data = 'data=' + encodeURIComponent('{"q-gender":"isFemale","q-age":"isUnder24","q-skintype":"isDrySkin","q-sensitivity":"isSensitiveSkin","q-mainconcern":"isSkinMoisture"}');
        // save User in db
        var user = this.user.set({'do_save': true});
        if (user) {
            user.save(null, {
                data: 'rdata=' + JSON.stringify(user.attributes),
                method: "GET"
            });
        }
        // display results
        this.$('#quiz').fadeOut(300, function() {
            self.$('#results').fadeIn(300);
        });
        // get and save results
        $.ajax({
            type: 'GET',
            url: '/json/results.json',
            data: data,
            success: function(data) {
                self.$('#results').html('<img src="' + app.settings.get('loading_img') + '" class="loading_img" />');
                if (data.total > 0) {
                    // wip: set user results
                    self.userResults = data.items;
                    // get answers
                    for (var key in self.dataObj) { // key = q-gender
                        questionAnswers = self.questions.get(key.substr(2)).get('answers');
                        for (var i in questionAnswers) {
                            if (questionAnswers[i].aid == self.dataObj[key]) {
                                userAnswers[key.substr(2)] = questionAnswers[i];
                            }
                        }
                    }
                    // display results
                    $('#intro').hide();
                    self.$('#results').html(self.templateResults({results: data.items, answers: userAnswers}));
                    app.settings.get('cache', 'document').trigger('diagnosticStepCompleted', {'step': 'results-loaded', 'answers': userAnswers, 'user': user});
                } else {
                    self.$('#results').html(app.settings.get('error_message', 'noresults')).show(); //wip: no result page
                    app.settings.get('cache', 'document').trigger('diagnosticStepCompleted', {'step': 'no-results'});
                }
            }
        });
    },
    showCollectionItems: function(response) {
        var $placeholder = this.$('#quiz').html(this.templateQuiz(response)),
            questionView = '',
            currentQuestionId = '',
            $currentQuestion = '',
            currentAnswers = '',
            presetFirstAnswer = '',
            nextQuestionId = '',
            flow = app.settings.get('flow'),
            found = false;
        this.visibleQuestions = [];
        this.questions.each(function(question) {
            questionView = new QuestionView({model: question});
            currentQuestionId = question.get('id');
            this.$('#quiz_form fieldset', $placeholder).append(questionView.render().$el);
            $currentQuestion = $('#question_' + currentQuestionId);
            // find first question and display it
            switch (flow) {
                case 'tree':
                    if (question.get('sort_order') == 1 && $currentQuestion.css('display') == 'none') {
                        presetFirstAnswer = $('input', $currentQuestion).val();
                        currentAnswers = this.questions.get(currentQuestionId).get('answers');
                        for (var i in currentAnswers) {
                            if (currentAnswers[i].aid == presetFirstAnswer && currentAnswers[i].hasOwnProperty('next_qid')) {
                                nextQuestionId = currentAnswers[i].next_qid;
                                break;
                            }
                        }
                    }
                    if ($currentQuestion.css('display') != 'none') {
                        this.visibleQuestions.push(question);
                        if (app.settings.get('transition') == 'fade' && question.get('sort_order') != 1 && currentQuestionId != nextQuestionId) {
                            $currentQuestion.addClass('hidden');
                        }
                    }
                    break;
                default:
                    if ($currentQuestion.css('display') != 'none') {
                        this.visibleQuestions.push(question);
                        if (app.settings.get('transition') == 'fade' && found) {
                            $currentQuestion.addClass('hidden');
                        }
                        found = true;
                    }
            }
            /* exception for age: commented out for privacy reason (we don't want to give away the user's birthday or age range)
            if (this.user.get('is_existing') && currentQuestionId == 'age') {
                $currentQuestion.addClass('hidden');
            }
            //*/
        }, this);
        this.$('#results').fadeOut(300, function() {
            self.$('#quiz').fadeIn(300, function() {
                app.settings.get('cache', 'document').trigger('diagnosticStepCompleted', {'step': 'quiz-loaded'});
            });
        });
    },
    validate: function() { //wip
        var errors = [];
        // validate all questions
        this.questions.each(function(question) {
            var key = 'q-' + question.id;
            switch (key) {
                case 'q-age':
                    /*
                    if (this.user.get('is_existing')) {
                        // wip: either delete dates, like below, or remove this condition to save the birthday again
                        delete this.dataObj.age_day;
                        delete this.dataObj.age_month;
                        delete this.dataObj.age_year;
                        break;
                    }
                    //*/
                    if (this.dataObj.hasOwnProperty('age_day') && this.dataObj.hasOwnProperty('age_month') && this.dataObj.hasOwnProperty('age_year')) {
                        // get age data (birthday, age range)
                        var ageData = this.getAge(this.dataObj);
                        // errors
                        if (!!ageData.error) {
                            errors.push({name: 'age', error: ageData.error});
                        } else {
                            // set User model birthday
                            this.user.set({'birthday': ageData.birthday});
                            // set the age range
                            this.dataObj['q-age'] = ageData.age_range;
                            // remove the unneeded properties
                            delete this.dataObj.age_day;
                            delete this.dataObj.age_month;
                            delete this.dataObj.age_year;
                        }
                    } else if (this.dataObj.hasOwnProperty('q-age')) {
                        // validate birthday
                        if (!this.dataObj['q-age']) {
                            errors.push({name: 'age', error: app.settings.get('error_message', 'age')});
                        }
                        // remove the unneeded properties
                        if (this.dataObj.hasOwnProperty('age_day')) {
                            delete this.dataObj.age_day;
                        }
                        if (this.dataObj.hasOwnProperty('age_month')) {
                            delete this.dataObj.age_month;
                        }
                        if (this.dataObj.hasOwnProperty('age_year')) {
                            delete this.dataObj.age_year;
                        }
                    } else {
                        errors.push({name: 'age', error: app.settings.get('error_message', 'age')});
                    }
                    break;

                default:
                    // wip: make sure there are answers to all visible questions
                    var hasError = false;
                    if (app.settings.get('transition') != 'fade') {
                        for (var i in this.visibleQuestions) {
                            if (this.visibleQuestions[i].id == question.id && !this.dataObj.hasOwnProperty(key)) {
                                hasError = true;
                                break;
                            }
                        }
                    }
                    if (hasError || this.dataObj.hasOwnProperty(key) && !this.dataObj[key]) {
                        errors.push({name: question.id, error: app.settings.get('error_message', 'default')});
                    }
            }
        }, this);

        // process errors
        return !this.processErrors(errors);
    },
    processErrors: function(errors) {
        var hasErrors = errors.length > 0;
        this.$('div.error_message').empty();
        if (hasErrors) {
            for (var key in errors) {
                if (errors.hasOwnProperty(key)) {
                    this.$('#question_' + errors[key].name).find('div.error_message').html('<span class="error_' + app.settings.get('locale') + '">' + errors[key].error + '</span>');
                }
            }
        }
        return hasErrors;
    },
    processSyncError: function(error) {
        console.log(error);
    }
});

// launch app
app.UI = new AppView();