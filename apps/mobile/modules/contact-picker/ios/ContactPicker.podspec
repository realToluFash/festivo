Pod::Spec.new do |s|
  s.name           = 'ContactPicker'
  s.version        = '0.0.0'
  s.summary        = 'The system contact picker, many at once'
  s.author         = 'Soirely'
  s.homepage       = 'https://soirely.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Contacts', 'ContactsUI'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
