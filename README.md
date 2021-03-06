# DilbertWidget

Script shows german daily dilbert. Pics from www.ingenieur.de are used.
To display a full comic strip, only one single pic is shown per widget.
You have to add multiple widget in one stack. So you can scroll through the comic
Widget parameter has to be set to select cover (0) or one iof the three pics (1, 2 or 3)

### Installation / Configuration
* install scriptable
* add this script as a new script
* create n scriptable
* select this script for all widgets
* each widget should get a number
   - 1st widget: 0 (to show the cover)
   - 2nd widget: 1 (to show the 1st pic of the comic)
   - 3rd widget: 2 (to show the 2nd pic of the comic)
   - 4th widget: 3 (to show the last pic of the comic)
* as 2nd parameter you can change the comic (beside Dilbert, Peanuts are supported)
* supported comics:
   - dilbert-de:   german Dilbert 
   - dilbert-en:  english Dilbert
   - peanuts:     english Peanuts
   - garfield:    english Garfield
* e.g.: 2,peanuts     (to get the 2nd pic of Peanuts comic)
* combine widgets in one stack
* if everything works fine, you can now scroll through the daily widget

![](movie.mov)

![](movie_peanuts.mov)

![](movie_dilbert_en.mov)

![](movie_garfield.mov)

![](config.jpg)

### Known Issues


### ChangeLog
- 2020-11-18 initial version
- 2020-11-20 ADD: If widget is not configured or started in sriptable app, install instructions are shown
- 2020-11-21 ADD: Support for daily Peanuts (selectable with widget parameter)
- 2020-11-23 FIX: Building image URL changed to webpage parsing.
- 2020-11-24 ADD: Support for daily Dilbert in english (selectable with widget parameter 'dilbert-en')
- 2020-11-24 ADD: Support for daily Garfield in english (selectable with widget parameter 'garfield')
- 2020-11-24 FIX: In some cases the widget was not able to handle images with higher resolution (limited now)
- 2020-12-02 FIX: In some cases there was a small line at the bottom of the widget
