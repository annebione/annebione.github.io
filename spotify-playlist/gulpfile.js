var gulp = require('gulp');
var browserify = require('gulp-browserify');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');

gulp.task('js', function() {
	gulp.src('js/main.js')
		.pipe(browserify({ debug: true }))
		.pipe(rename('js/bundle.js'))
		.pipe(uglify())
		.pipe(gulp.dest('./'))
});

gulp.task('watch', function() {
	gulp.watch('js/**/*.js', ['js']);
});