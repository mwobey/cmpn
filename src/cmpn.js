'use strict';

var request = require("request-promise").defaults({ resolveWithFullResponse: true, simple: false });

class CompanionAPIError extends Error { constructor(message) { super(message); this.name = "CompanionAPIError";  } }


class Companion {
  constructor (email_in=null, password_in=null) {
    this._email = email_in;
    this._password = password_in;
    this.state = Companion.STATES.INIT;
    this.headers = {
      'User-Agent': '(iPhone; CPU iPhone OS 7_1_2 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Mobile/11D257'
    };
    this.cookies = request.jar();
  }
  
  get email () { return this._email; }
  set email (v) {
    if ( this.email != v ) {
      this.clear_session();
    }
    this._email = v;
  }

  get password () { return this._password; }
  set password (v) {
    if ( this.password != v ) {
      this.clear_session();
    }
    this._password = v;
  }

  clear_session() {
    this.cookies = request.jar();
    this.state = Companion.STATES.INIT;
  }
  
  login ( email=null, password=null ) {
    this.email = email || this.email;
    this.password = password || this.password;

    if ( !this.email || !this.password ) {
      throw new CompanionAPIError("Must supply a Frontier email and password in order to access the Companion API.")
    }
    if ( this.state <= Companion.STATES.ERROR_CREDENTIALS ) {
      return request({
        url: Companion.URLS.LOGIN,
        method: 'POST',
        jar: this.cookies,
        headers: this.headers,
        form: { email: this.email, password: this.password }
      }).then((response) => {
        if ( response.statusCode >= 400 ) {
          throw new CompanionAPIError("Failed to connect to Companion API.");
        }
        else if (response.statusCode == 302) {
          switch ( response.headers.location ) {
            case "/user/login":
                  this.state = Companion.STATES.ERROR_CREDENTIALS;
                  break;
            case "/user/confirm":
                  this.state = Companion.STATES.VERIFY_NEEDED;
                  break;
            default:
                  this.state = Companion.STATES.LOGGED_IN;
          }
        }
        else if ( response.statusCode == 200 && response.body.indexOf("Authentication failed") > 0) {
          this.state = Companion.STATES.ERROR_CREDENTIALS;
        }
        else {
          throw new CompanionAPIError("Unhandled Response.");
        }
        return this.state;

      });//make login request, returning a promise that will resolve to the new login state
    }//if not yet logged in
  }//login

  verify ( code=null ) {
    if (!code) {
      throw new CompanionAPIError("Must supply a validation code in order to verify usage from a new computer.")
    }
    throw new Error("Not Implemented");
  }

}//class Companion

//region Enums
Companion.STATES = Object.freeze({
  "INIT": 1,
  "ERROR_CREDENTIALS": 2,
  "VERIFY_NEEDED": 3,
  "LOGGED_IN": 4
});

Companion.URLS = Object.freeze({
  LOGIN: "https://companion.orerve.net/user/login",
  VERIFY: "https://companion.orerve.net/user/confirm",
  UPDATE: "https://companion.orerve.net/profile"
});
//endregion



module.exports = Companion;

//region Functions for CLI

var readline = require("readline");

var cli_state_handler = (state) => {
  if (state == Companion.STATES.ERROR_CREDENTIALS) {
    throw new CompanionAPIError("Invalid login.")
  }
  else if (state == Companion.STATES.VERIFY_NEEDED) {
    cmpn.verify(readline.prompt("Enter verification code: ")).then(cli_state_handler);
  }
};

if ( require.main == module ) {

  var cmpn = new Companion("mobetz@gmail.com", "asdf");
  cmpn.login().then(cli_state_handler);

  return 0;
}

//endregion