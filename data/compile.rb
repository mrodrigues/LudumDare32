require 'json'

words = File.readlines('words')
propernames = File.readlines('propernames')

words = words - propernames

words = words.map(&:strip).map(&:upcase).uniq

words = words - ["B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]

words_hash = words.inject({}) { |hash, word| hash[word] = false; hash }

File.open('words.json', 'wb') do |file|
  file << words_hash.to_json
end
