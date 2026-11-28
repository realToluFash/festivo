Pod::Spec.new do |s|
  s.name           = 'ScreenBrightness'
  s.version        = '0.0.0'
  s.summary        = 'Full brightness while a door code is shown (sc-72).'
  s.author         = 'Soirely'
  s.homepage       = 'https://soirely.com'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
